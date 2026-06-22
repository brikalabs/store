import { inject } from "@brika/di";
import type { Comment, Review, UserProfile } from "@brika/registry-contract";
import { getPluginPage } from "@/lib/registry/registry";
import { CommentStore } from "@/server/stores/comment-store";
import { PluginStore } from "@/server/stores/plugin-store";
import { type ReviewInput, ReviewStore } from "@/server/stores/review-store";
import { UserProfileStore } from "@/server/stores/user-profile-store";
import { UserStore } from "@/server/stores/user-store";

/**
 * The store's social use cases (reviews, comments, profiles), composed over the repositories. Owns
 * the cross-store steps (cache-aside fetch before a write, rating recompute after) so the stores
 * stay pure SQL and the routes stay a one-line call.
 */
export class SocialService {
  readonly #reviews = inject(ReviewStore);
  readonly #comments = inject(CommentStore);
  readonly #plugins = inject(PluginStore);
  readonly #profiles = inject(UserProfileStore);
  readonly #users = inject(UserStore);

  /**
   * Ensure a `plugins` cache row exists (cache-aside from the registry read model) so
   * reviews/comments can reference it. False when the name is not a Brika plugin (route 404s).
   */
  async ensurePluginCached(name: string): Promise<boolean> {
    if (await this.#plugins.exists(name)) return true;
    const page = await getPluginPage(name);
    if (page === null) return false;
    await this.#plugins.insertFromDetail(page.detail);
    return true;
  }

  listReviews(pluginName: string, viewerId: string | null = null): Promise<Review[]> {
    return this.#reviews.listForPlugin(pluginName, viewerId);
  }

  listReviewsByUser(userId: string): Promise<Review[]> {
    return this.#reviews.listByUser(userId);
  }

  /** Submit (or edit) a review, then refresh the plugin's denormalized rating. */
  async submitReview(pluginName: string, userId: string, input: ReviewInput): Promise<void> {
    await this.#reviews.upsert(pluginName, userId, input);
    await this.#plugins.recomputeRating(pluginName);
  }

  toggleReviewHelpful(reviewId: string, userId: string): Promise<boolean> {
    return this.#reviews.toggleHelpful(reviewId, userId);
  }

  listComments(pluginName: string, viewerId: string | null = null): Promise<Comment[]> {
    return this.#comments.listForPlugin(pluginName, viewerId);
  }

  /** Post a comment/reply; false when `parentId` targets a missing or cross-plugin parent. */
  addComment(
    pluginName: string,
    userId: string,
    body: string,
    parentId: string | null,
  ): Promise<boolean> {
    return this.#comments.add(pluginName, userId, body, parentId);
  }

  toggleCommentUpvote(commentId: string, userId: string): Promise<boolean> {
    return this.#comments.toggleUpvote(commentId, userId);
  }

  getUserProfile(id: string): Promise<UserProfile | null> {
    return this.#profiles.get(id);
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
    return this.#profiles.upsert(id, fields);
  }

  /** Set (or clear, with null) the account's uploaded-avatar content version, leaving the profile fields. */
  setUserAvatar(id: string, avatarVersion: string | null): Promise<void> {
    return this.#profiles.setAvatarVersion(id, avatarVersion);
  }

  /** The account id for a verified email, or null - resolves a scope invite's typed email to a user. */
  findUserIdByEmail(email: string): Promise<string | null> {
    return this.#users.findIdByEmail(email);
  }
}
