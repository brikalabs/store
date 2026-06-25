# Politique de confidentialité

> **Brouillon, pas encore en vigueur.** En attente de relecture juridique. Voir
> l'[aperçu juridique](/legal).
> Traduction automatique depuis l'anglais : en cas de divergence, la version anglaise fait foi.

**Last updated:** 2026-06-15

La présente Politique de confidentialité explique quelles données la plateforme
Brika (**store.brika.dev** et **registry.brika.dev**), exploitée par **Brika
Labs**, collecte et comment nous les traitons. Elle fait partie des
[Conditions d'utilisation](/legal/terms).

## 1. Données que nous collectons

- **Données de compte (depuis GitHub OAuth).** Lorsque vous vous connectez, nous
  recevons votre identifiant utilisateur GitHub, votre nom d'utilisateur, votre
  nom d'affichage, l'URL de votre avatar et l'adresse e-mail associée à votre
  compte GitHub. Nous ne recevons pas votre mot de passe GitHub.
- **Données d'éditeur et de provenance.** Lorsque vous publiez, nous enregistrons
  les métadonnées du paquet et la provenance de la publication : pour les
  publications via CI utilisant GitHub OIDC, le dépôt, le workflow, le commit et
  l'acteur ; pour les publications locales, l'utilisateur authentifié. Cela fait
  partie de l'enregistrement de la chaîne d'approvisionnement et peut être affiché
  publiquement.
- **Contenu public que vous créez.** Les paquets et leurs métadonnées, les avis,
  les notations, les commentaires et les informations de profil sont publics par
  conception.
- **Indicateurs d'usage et agrégés.** Les nombres de téléchargements et
  d'installations, qui sont agrégés et ne servent pas à suivre des individus.
- **Données techniques et de sécurité.** Les journaux de requêtes, les adresses IP
  et les chaînes user-agent, utilisés pour la limitation de débit, la prévention
  des abus, le débogage et la sécurité.
- **Cookie de session.** Un unique cookie de session signé (HMAC) qui vous
  maintient connecté. Nous n'utilisons pas de cookies publicitaires tiers ni de
  cookies de suivi intersites. Voir les
  [paramètres des cookies](/legal/cookies).

## 2. Comment nous utilisons les données

- Pour exploiter les Services : vous authentifier, servir les paquets, faire
  fonctionner la console d'éditeur et afficher le registre public et le contenu
  social.
- Pour sécuriser les Services : faire respecter les quotas et la Politique
  d'utilisation acceptable, prévenir les abus et enquêter sur les incidents de
  sécurité.
- Pour maintenir l'intégrité de la chaîne d'approvisionnement : conserver un
  enregistrement immuable des versions publiées et de leur provenance.
- Pour communiquer avec vous au sujet de votre compte, de la sécurité ou des
  modifications de politique.

## 3. Bases légales (lorsque le RGPD ou une loi similaire s'applique)

- **Exécution d'un contrat :** fournir les Services auxquels vous vous êtes
  inscrit.
- **Intérêts légitimes :** sécuriser la plateforme, prévenir les abus et maintenir
  l'enregistrement d'intégrité du registre.
- **Consentement :** lorsqu'il est expressément demandé (par exemple pour les
  communications facultatives).
- **Obligation légale :** lorsque nous devons conserver ou divulguer des données
  en vertu de la loi.

## 4. Comment les données sont partagées

- **Prestataires de services (sous-traitants).** Cloudflare fournit
  l'hébergement, le stockage (D1, R2, KV) et la diffusion de contenu ; jsDelivr
  sert les actifs publics des paquets. Ils traitent les données pour notre compte
  afin de faire fonctionner les Services.
- **GitHub.** Utilisé pour l'authentification et l'identité ; le registre npm est
  interrogé pour la découverte fédérée des paquets communautaires.
- **Publiquement.** Les données du registre, la provenance et le contenu social
  que vous publiez sont publics de par la nature d'un registre de paquets.
- **Légalement.** Nous pouvons divulguer des données lorsque la loi l'exige ou
  pour protéger les utilisateurs, le public ou les Services.
- Nous ne **vendons pas** vos données personnelles.

## 5. Transferts internationaux

Les Services fonctionnent sur le réseau périphérique mondial de Cloudflare, de
sorte que les données peuvent être traitées dans des pays autres que le vôtre.
Lorsque cela est requis, nous nous appuyons sur des garanties appropriées pour les
transferts internationaux.

## 6. Conservation

- **Les données de compte** sont conservées tant que votre compte est actif. Si
  vous fermez votre compte, nous supprimons ou anonymisons vos données de compte
  personnelles, sous réserve des exceptions ci-dessous.
- **Les données publiques des paquets et la provenance** peuvent être conservées
  même après la fermeture du compte, car les versions publiées sont immuables et
  l'enregistrement d'intégrité et de provenance est utilisé par tous ceux qui ont
  installé ces versions.
- **Les journaux techniques** sont conservés pendant une période limitée à des
  fins de sécurité et de débogage, puis supprimés ou agrégés.

## 7. Vos droits

Selon votre lieu de résidence, vous pouvez avoir le droit d'accéder à vos données
personnelles, de les corriger, de les supprimer, de les exporter ou de vous
opposer à leur traitement. Nous honorerons les demandes valides, avec une limite
importante : nous ne pouvons généralement pas supprimer les versions de paquets
déjà publiées ni leur provenance, car l'écosystème dépend de leur immuabilité et
de leur intégrité. Pour exercer un droit, contactez **privacy@brika.dev**.

## 8. Enfants

Les Services ne sont pas destinés aux enfants de moins de 13 ans (ou de l'âge du
consentement numérique dans votre pays, s'il est plus élevé), et nous ne
collectons pas sciemment leurs données personnelles.

## 9. Modifications

Nous pouvons mettre à jour la présente Politique de confidentialité. Les
modifications prennent effet lorsque nous mettons à jour la date "Last updated"
ci-dessus, avec un avis diffusé via les Services pour les modifications
importantes.

## 10. Contact

Questions ou demandes relatives à la confidentialité : **privacy@brika.dev**.
