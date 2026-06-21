import type { Comment, Review, UserProfile } from "@brika/registry-contract";
import { getPluginPage } from "@/lib/registry/registry";
import type { CommentStore } from "@/server/stores/comment-store";
import type { PluginStore } from "@/server/stores/plugin-store";
import type { ReviewInput, ReviewStore } from "@/server/stores/review-store";
import type { UserProfileStore } from "@/server/stores/user-profile-store";
import type { UserStore } from "@/server/stores/user-store";

/** The repositories the social use cases compose. Wired once by {@link socialService}. */
export interface SocialStores {
  readonly users: UserStore;
  readonly profiles: UserProfileStore;
  readonly reviews: ReviewStore;
  readonly comments: CommentStore;
  readonly plugins: PluginStore;
}

/**
 * The store's social use cases (reviews, comments, profiles), composed over the repositories.
 * This is the only orchestration layer the route handlers see: it owns the cross-store steps -
 * the cache-aside FETCH from the registry read model before a write, and the rating recompute
 * after one - so the stores stay pure SQL and the routes stay a one-line call. Pure of
 * `cloudflare:workers`, so it is unit-testable with an in-memory db (see {@link socialService}
 * for the production composition).
 */
export class SocialService {
  readonly #stores: SocialStores;

  constructor(stores: SocialStores) {
    this.#stores = stores;
  }

  /**
   * Ensure a `plugins` cache row exists so reviews/comments can reference it: a row already
   * there short-circuits; otherwise the registry read model is consulted and the row written.
   * Returns false when the name is not a Brika plugin (the route maps that to 404).
   */
  async ensurePluginCached(name: string): Promise<boolean> {
    if (await this.#stores.plugins.exists(name)) return true;
    const page = await getPluginPage(name);
    if (page === null) return false;
    await this.#stores.plugins.insertFromDetail(page.detail);
    return true;
  }

  listReviews(pluginName: string, viewerId: string | null = null): Promise<Review[]> {
    return this.#stores.reviews.listForPlugin(pluginName, viewerId);
  }

  listReviewsByUser(userId: string): Promise<Review[]> {
    return this.#stores.reviews.listByUser(userId);
  }

  /** Submit (or edit) a review, then refresh the plugin's denormalized rating. */
  async submitReview(pluginName: string, userId: string, input: ReviewInput): Promise<void> {
    await this.#stores.reviews.upsert(pluginName, userId, input);
    await this.#stores.plugins.recomputeRating(pluginName);
  }

  toggleReviewHelpful(reviewId: string, userId: string): Promise<boolean> {
    return this.#stores.reviews.toggleHelpful(reviewId, userId);
  }

  listComments(pluginName: string, viewerId: string | null = null): Promise<Comment[]> {
    return this.#stores.comments.listForPlugin(pluginName, viewerId);
  }

  addComment(
    pluginName: string,
    userId: string,
    body: string,
    parentId: string | null,
  ): Promise<void> {
    return this.#stores.comments.add(pluginName, userId, body, parentId);
  }

  toggleCommentUpvote(commentId: string, userId: string): Promise<boolean> {
    return this.#stores.comments.toggleUpvote(commentId, userId);
  }

  getUserProfile(id: string): Promise<UserProfile | null> {
    return this.#stores.profiles.get(id);
  }

  updateUserProfile(
    id: string,
    fields: {
      displayName?: string;
      bio?: string;
      website?: string;
      links?: { label: string; url: string }[];
    },
  ): Promise<void> {
    return this.#stores.profiles.upsert(id, fields);
  }

  /** The account's GitHub login, for the ownership-derived "published plugins" on a profile. */
  findUserLogin(id: string): Promise<string | null> {
    return this.#stores.users.findLogin(id);
  }
}
