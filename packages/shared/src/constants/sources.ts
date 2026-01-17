import type { SourceType, SourceCategory } from '../types/article.js';

export interface RSSSourceConfig {
  name: string;
  slug: string;
  type: SourceType;
  category: SourceCategory;
  region?: string;
  feedUrl: string;
  alternativeFeeds?: string[];
  fetchIntervalMinutes: number;
}

export const RSS_SOURCES: RSSSourceConfig[] = [
  // ========== NATIONAL PRESS ==========
  {
    name: 'Le Monde',
    slug: 'le-monde',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.lemonde.fr/rss/une.xml',
    alternativeFeeds: [
      'https://www.lemonde.fr/politique/rss_full.xml',
      'https://www.lemonde.fr/economie/rss_full.xml',
      'https://www.lemonde.fr/societe/rss_full.xml',
    ],
    fetchIntervalMinutes: 30,
  },
  {
    name: 'Le Figaro',
    slug: 'le-figaro',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
    alternativeFeeds: [
      'https://www.lefigaro.fr/rss/figaro_politique.xml',
      'https://www.lefigaro.fr/rss/figaro_economie.xml',
    ],
    fetchIntervalMinutes: 30,
  },
  {
    name: 'Libération',
    slug: 'liberation',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-une/',
    fetchIntervalMinutes: 30,
  },
  {
    name: 'Le Parisien',
    slug: 'le-parisien',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://feeds.leparisien.fr/leparisien/rss',
    fetchIntervalMinutes: 30,
  },
  {
    name: 'Les Échos',
    slug: 'les-echos',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.lesechos.fr/rss/rss_une.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'France Info',
    slug: 'france-info',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.francetvinfo.fr/titres.rss',
    fetchIntervalMinutes: 30,
  },
  {
    name: '20 Minutes',
    slug: '20-minutes',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.20minutes.fr/feeds/rss-une.xml',
    fetchIntervalMinutes: 30,
  },
  {
    name: 'Le Point',
    slug: 'le-point',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.lepoint.fr/rss.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: "L'Express",
    slug: 'lexpress',
    type: 'rss',
    category: 'national',
    feedUrl: 'https://www.lexpress.fr/rss/alaune.xml',
    fetchIntervalMinutes: 45,
  },

  // ========== REGIONAL PRESS ==========
  {
    name: 'Ouest-France',
    slug: 'ouest-france',
    type: 'rss',
    category: 'regional',
    region: 'Bretagne / Normandie / Pays de la Loire',
    feedUrl: 'https://www.ouest-france.fr/rss/une',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Sud Ouest',
    slug: 'sud-ouest',
    type: 'rss',
    category: 'regional',
    region: 'Nouvelle-Aquitaine',
    feedUrl: 'https://www.sudouest.fr/essentiel/rss.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'La Voix du Nord',
    slug: 'la-voix-du-nord',
    type: 'rss',
    category: 'regional',
    region: 'Hauts-de-France',
    feedUrl: 'https://www.lavoixdunord.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Le Télégramme',
    slug: 'le-telegramme',
    type: 'rss',
    category: 'regional',
    region: 'Bretagne',
    feedUrl: 'https://www.letelegramme.fr/rss.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Le Dauphiné Libéré',
    slug: 'le-dauphine-libere',
    type: 'rss',
    category: 'regional',
    region: 'Auvergne-Rhône-Alpes',
    feedUrl: 'https://www.ledauphine.com/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'La Nouvelle République',
    slug: 'la-nouvelle-republique',
    type: 'rss',
    category: 'regional',
    region: 'Centre-Val de Loire',
    feedUrl: 'https://www.lanouvellerepublique.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Le Progrès',
    slug: 'le-progres',
    type: 'rss',
    category: 'regional',
    region: 'Auvergne-Rhône-Alpes',
    feedUrl: 'https://www.leprogres.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'La Montagne',
    slug: 'la-montagne',
    type: 'rss',
    category: 'regional',
    region: 'Auvergne',
    feedUrl: 'https://www.lamontagne.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: "Dernières Nouvelles d'Alsace",
    slug: 'dna',
    type: 'rss',
    category: 'regional',
    region: 'Alsace',
    feedUrl: 'https://www.dna.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'La Dépêche du Midi',
    slug: 'la-depeche-du-midi',
    type: 'rss',
    category: 'regional',
    region: 'Occitanie',
    feedUrl: 'https://www.ladepeche.fr/rss.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: "L'Est Républicain",
    slug: 'lest-republicain',
    type: 'rss',
    category: 'regional',
    region: 'Grand Est',
    feedUrl: 'https://www.estrepublicain.fr/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Midi Libre',
    slug: 'midi-libre',
    type: 'rss',
    category: 'regional',
    region: 'Occitanie',
    feedUrl: 'https://www.midilibre.fr/rss.xml',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'La Provence',
    slug: 'la-provence',
    type: 'rss',
    category: 'regional',
    region: 'Provence-Alpes-Côte d\'Azur',
    feedUrl: 'https://www.laprovence.com/rss',
    fetchIntervalMinutes: 45,
  },
  {
    name: 'Nice-Matin',
    slug: 'nice-matin',
    type: 'rss',
    category: 'regional',
    region: 'Provence-Alpes-Côte d\'Azur',
    feedUrl: 'https://www.nicematin.com/rss',
    fetchIntervalMinutes: 45,
  },
];

export interface SocialSourceConfig {
  name: string;
  slug: string;
  type: SourceType;
  category: 'social';
  platform: 'twitter' | 'mastodon' | 'bluesky';
  identifier: string;
  description: string;
}

export const SOCIAL_SOURCES: SocialSourceConfig[] = [
  // Twitter/X accounts to monitor
  {
    name: 'IFRAP',
    slug: 'twitter-ifrap',
    type: 'twitter',
    category: 'social',
    platform: 'twitter',
    identifier: 'Abordeleau',
    description: 'Fondation IFRAP - think tank libéral',
  },
  {
    name: 'Contribuables Associés',
    slug: 'twitter-contribuables',
    type: 'twitter',
    category: 'social',
    platform: 'twitter',
    identifier: 'Abordeleau',
    description: 'Association de contribuables',
  },
];

export const MASTODON_INSTANCES = [
  'piaille.fr',
  'framapiaf.org',
  'mamot.fr',
  'social.music.fr',
];

export const SEARCH_KEYWORDS_FR = [
  'bureaucratie',
  'administration française',
  'réglementation absurde',
  'paperasse',
  'formulaire CERFA',
  'simplification administrative',
  'dépense publique',
  'gaspillage',
  'normes excessives',
  'sur-administration',
  'fonctionnaires',
  'charges administratives',
  'complexité fiscale',
  'impôts locaux',
  'taxe',
];

export const RELEVANT_HASHTAGS_FR = [
  '#bureaucratie',
  '#administration',
  '#simplification',
  '#réforme',
  '#fiscalité',
  '#impôts',
  '#servicePublic',
  '#collectivités',
];
