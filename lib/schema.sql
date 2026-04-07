-- Table membres famille GHUSSEIN
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(1) DEFAULT '',
  birth VARCHAR(20) DEFAULT '',
  birth_place VARCHAR(255) DEFAULT '',
  dead BOOLEAN DEFAULT FALSE,
  death_info VARCHAR(255) DEFAULT '',
  note TEXT DEFAULT '',
  parents INTEGER[] DEFAULT '{}',
  children INTEGER[] DEFAULT '{}',
  spouses INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Données initiales famille GHUSSEIN
INSERT INTO family_members (id, name, gender, birth, birth_place, dead, death_info, parents, children, spouses, note) VALUES
(1, 'GHUSSEIN Ismael', 'M', '11/01/1936', 'Dabola', TRUE, '11/01/2016 à Toulouse', '{}', '{5,6,7,8,9,10,11}', '{2}', 'Fils de GHUSSEIN Mohamed Gassim et CAMARA N''Gamma'),
(2, 'BARRY Raymonde', 'F', '12/06/1939', 'Conakry', FALSE, '', '{}', '{5,6,7,8,9,10,11}', '{1}', 'Fille de BARRY Madiou (1904, Pita – déc. 03/10/1954) et ROMAGE Hélène'),
(5, 'GHUSSEIN Marie-Hélène', 'F', '26/09/1960', 'Dabola', FALSE, '', '{1,2}', '{21,22,23,24,25}', '{30}', ''),
(6, 'GHUSSEIN Kadija', 'F', '22/07/1962', 'Dabola', FALSE, '', '{1,2}', '{31}', '{}', ''),
(7, 'GHUSSEIN Mohamed', 'M', '04/04/1964', 'Le Caire', TRUE, '25/11/2013 à Conakry', '{1,2}', '{33,34}', '{32}', ''),
(8, 'GHUSSEIN Zeinab', 'F', '28/07/1965', 'Le Caire', FALSE, '', '{1,2}', '{36,37}', '{38}', ''),
(9, 'GHUSSEIN Fadel', 'M', '03/08/1969', 'Fria', FALSE, '', '{1,2}', '{39}', '{40}', ''),
(10, 'GHUSSEIN Madiou', 'M', '13/06/1972', '', FALSE, '', '{1,2}', '{}', '{}', ''),
(11, 'GHUSSEIN Moustapha', 'M', '10/11/1974', '', FALSE, '', '{1,2}', '{41,42,43}', '{}', ''),
(21, 'BAH Ismael', 'M', '10/12/1997', 'Conakry', FALSE, '', '{5,30}', '{}', '{}', ''),
(22, 'BAH Safiatou', 'F', '06/10/1982', 'Conakry', FALSE, '', '{5,30}', '{}', '{}', ''),
(23, 'BAH Raymonde', 'F', '04/02/1985', 'Conakry', FALSE, '', '{5,30}', '{}', '{}', ''),
(24, 'BAH Hervé Vincent', 'M', '23/08/1986', 'Conakry', FALSE, '', '{5,30}', '{}', '{}', ''),
(25, 'BAH Lansana', 'M', '27/08/2001', 'Conakry', FALSE, '', '{5,30}', '{}', '{}', ''),
(30, 'BAH Tanou', 'M', '', '', FALSE, '', '{}', '{21,22,23,24,25}', '{5}', ''),
(31, 'MIGAN VIGNON Bruno Ismael', 'M', '11/12/1995', 'Toulouse', FALSE, '', '{6}', '{}', '{}', ''),
(32, 'KOUYATE Assiatou', 'F', '09/05/1970', 'Conakry', FALSE, '', '{}', '{33,34}', '{7}', ''),
(33, 'GHUSSEIN Iman Kadyja Victoria', 'F', '11/01/1998', 'Villepinte', FALSE, '', '{7,32}', '{}', '{}', ''),
(34, 'GHUSSEIN Jasmine Raymonde', 'F', '16/06/2007', 'Paris 15', FALSE, '', '{7,32}', '{}', '{}', ''),
(36, 'GARBA GHUSSEIN Zouena Sarah', 'F', '', '', FALSE, '', '{8,38}', '{}', '{}', ''),
(37, 'GHUSSEIN Charlène', 'F', '08/03/1998', 'Toulouse', FALSE, '', '{8,38}', '{}', '{}', ''),
(38, 'AGBOKOU Jean Jacques', 'M', '', '', FALSE, '', '{}', '{36,37}', '{8}', ''),
(39, 'PERMAL GHUSSEIN Luciana', 'F', '01/07/1993', 'Toulouse', FALSE, '', '{9,40}', '{}', '{}', ''),
(40, 'ROUX Alexandrine', 'F', '04/11/1972', 'Toulouse', FALSE, '', '{}', '{39}', '{9}', ''),
(41, 'GHUSSEIN Mathéo Alain Bruno Gassim', 'M', '26/02/2000', 'Toulouse', FALSE, '', '{11}', '{}', '{}', ''),
(42, 'GHUSSEIN Brice Étienne Ismael', 'M', '06/08/2002', 'Toulouse', FALSE, '', '{11}', '{}', '{}', ''),
(43, 'GHUSSEIN Jade Raymonde Michelle', 'F', '27/04/2009', 'Toulouse', FALSE, '', '{11}', '{}', '{}', '')
ON CONFLICT (id) DO NOTHING;

-- Ajuster la séquence après les insertions manuelles
SELECT setval('family_members_id_seq', (SELECT MAX(id) FROM family_members) + 1);
