-- Seed data for French news sources
-- This populates the sources table with RSS feeds

INSERT INTO sources (name, slug, type, category, url, region, fetch_interval_minutes) VALUES
-- National Press
('Le Monde', 'le-monde', 'rss', 'national', 'https://www.lemonde.fr/rss/une.xml', NULL, 30),
('Le Figaro', 'le-figaro', 'rss', 'national', 'https://www.lefigaro.fr/rss/figaro_actualites.xml', NULL, 30),
('Libération', 'liberation', 'rss', 'national', 'https://www.liberation.fr/arc/outboundfeeds/rss-all/collection/accueil-une/', NULL, 30),
('Le Parisien', 'le-parisien', 'rss', 'national', 'https://feeds.leparisien.fr/leparisien/rss', NULL, 30),
('Les Échos', 'les-echos', 'rss', 'national', 'https://www.lesechos.fr/rss/rss_une.xml', NULL, 45),
('France Info', 'france-info', 'rss', 'national', 'https://www.francetvinfo.fr/titres.rss', NULL, 30),
('20 Minutes', '20-minutes', 'rss', 'national', 'https://www.20minutes.fr/feeds/rss-une.xml', NULL, 30),
('Le Point', 'le-point', 'rss', 'national', 'https://www.lepoint.fr/rss.xml', NULL, 45),
('L''Express', 'lexpress', 'rss', 'national', 'https://www.lexpress.fr/rss/alaune.xml', NULL, 45),

-- Regional Press
('Ouest-France', 'ouest-france', 'rss', 'regional', 'https://www.ouest-france.fr/rss/une', 'Bretagne / Normandie / Pays de la Loire', 45),
('Sud Ouest', 'sud-ouest', 'rss', 'regional', 'https://www.sudouest.fr/essentiel/rss.xml', 'Nouvelle-Aquitaine', 45),
('La Voix du Nord', 'la-voix-du-nord', 'rss', 'regional', 'https://www.lavoixdunord.fr/rss', 'Hauts-de-France', 45),
('Le Télégramme', 'le-telegramme', 'rss', 'regional', 'https://www.letelegramme.fr/rss.xml', 'Bretagne', 45),
('Le Dauphiné Libéré', 'le-dauphine-libere', 'rss', 'regional', 'https://www.ledauphine.com/rss', 'Auvergne-Rhône-Alpes', 45),
('La Nouvelle République', 'la-nouvelle-republique', 'rss', 'regional', 'https://www.lanouvellerepublique.fr/rss', 'Centre-Val de Loire', 45),
('Le Progrès', 'le-progres', 'rss', 'regional', 'https://www.leprogres.fr/rss', 'Auvergne-Rhône-Alpes', 45),
('La Montagne', 'la-montagne', 'rss', 'regional', 'https://www.lamontagne.fr/rss', 'Auvergne', 45),
('Dernières Nouvelles d''Alsace', 'dna', 'rss', 'regional', 'https://www.dna.fr/rss', 'Alsace', 45),
('La Dépêche du Midi', 'la-depeche-du-midi', 'rss', 'regional', 'https://www.ladepeche.fr/rss.xml', 'Occitanie', 45),
('L''Est Républicain', 'lest-republicain', 'rss', 'regional', 'https://www.estrepublicain.fr/rss', 'Grand Est', 45),
('Midi Libre', 'midi-libre', 'rss', 'regional', 'https://www.midilibre.fr/rss.xml', 'Occitanie', 45),
('La Provence', 'la-provence', 'rss', 'regional', 'https://www.laprovence.com/rss', 'Provence-Alpes-Côte d''Azur', 45),
('Nice-Matin', 'nice-matin', 'rss', 'regional', 'https://www.nicematin.com/rss', 'Provence-Alpes-Côte d''Azur', 45)

ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    region = EXCLUDED.region,
    fetch_interval_minutes = EXCLUDED.fetch_interval_minutes,
    updated_at = NOW();
