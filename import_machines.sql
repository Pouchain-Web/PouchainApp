INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 032', 'Chariot porte palan TRACTEL bleu corso 0,5t D 145067201 (mobile pour les chantiers)', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2022-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 033', 'Palan OPSIAL TRALIFT NO T1136587 - 2011 1T (mobile pour les chantiers)', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2022-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 034', 'Grue d''atelier WURTH Type 0715 93 82 CMU 0,55T N°s 511557', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2022-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 035', 'Cric WURTH Type 0715 54 200 N°s 536244 CMU 2T', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 036', 'gerbeur LEVAC 1T n°EUCC6141G-1261', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 037', 'gerbeur LEVAC 1T N°s EUCC6141G-1360', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 038', 'CRIC NORAUTO AGENCE', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 039', 'Cric forestier HUCHEZ Type 729.3T N°009164 CMU 3T BLEU', 'Manutention', 6, 'nan', true, 'OK', 'nan', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 040', 'Cric forestier LEVAC 6009B  5T N°1700069', 'Manutention', 6, 'nan', true, 'OK', 'Charge d''essai disponible inférieure à la charge de référence (fait à 3T). Faire procéder aux essais correspondant à la capacité nominale si vous devez lever des charges supérieures à celle utilisée lors des essais.', '2023-02-26', '2023-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('LEVAC
PORTIQUE', 'Ensemble poste fixe PORTIQUE (portique+porte palan+palan)
Portique LEVAC 2t type 6125 N°s 2523 + Palan manuel 2t type 6051CE-03 N°s 4125623

Chariot Porte-palan LEVAC HALTIR 2T 15052327

Palan LEVAC HALTIR 605 2T  ICE-03 N°4125823', 'Manutention', 12, 'nan', true, 'OK', 'observations linguet manquant', '2023-08-26', '2022-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('TRALIFT PRESSE', 'Palan TRACTEL TRALIFT 0,5T n°12084518 (poste fixe)', 'Manutention', 12, 'nan', true, 'OK', 'nan', '2023-08-26', '2022-08-26')
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 070', 'Cric hydraulique type 6010A CMU 5t N°s GL22011178', 'Manutention', 6, 'nan', true, NULL, 'a faire en 2023', '2023-10-26', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 071', 'Elingue Verte 1t 1m Marque SECURA modèle 4428M10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 072', 'Elingue Verte 1t 1m Marque SECURA modèle 4428M10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 073', 'Elingue Verte 1t 2m Marque SECURA modèle 4428M20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 074', 'Elingue Verte 1t 2m Marque SECURA modèle 4428M20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 075', 'Elingue Verte 1t 3m Marque SECURA modèle 4428M30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 076', 'Elingue Verte 1t 3m Marque SECURA modèle 4428M30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 077', 'Elingue Verte 2t 1m Marque SECURA modèle 4428N10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 078', 'Elingue Verte 2t 1m Marque SECURA modèle 4428N10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 079', 'Elingue Verte 2t 2m Marque SECURA modèle 4428N20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 080', 'Elingue Verte 2t 2m Marque SECURA modèle 4428N20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 081', 'Elingue Verte 2t 3m Marque SECURA modèle 4428N30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 082', 'Elingue Verte 2t 3m Marque SECURA modèle 4428N30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 083', 'Elingue Verte 3t 1m Marque SECURA modèle 4428P10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 084', 'Elingue Verte 3t 1m Marque SECURA modèle 4428P10', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 085', 'Elingue Verte 3t 2m Marque SECURA modèle 4428P20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 086', 'Elingue Verte 3t 2m Marque SECURA modèle 4428P20', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 087', 'Elingue Verte 3t 3m Marque SECURA modèle 4428P30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;
INSERT INTO public.machines (machine_id, name, family, periodicity, assigned_to, status_active, vgp_status, vgp_observations, next_maintenance_date, last_vgp_date)
VALUES ('PCH LVG 088', 'Elingue Verte 3t 3m Marque SECURA modèle 4428P30', 'Manutention', 12, 'nan', true, NULL, 'a faire en 2023', '2023-12-01', NULL)
ON CONFLICT (machine_id) DO UPDATE SET 
    name = EXCLUDED.name, 
    family = EXCLUDED.family, 
    periodicity = EXCLUDED.periodicity, 
    assigned_to = EXCLUDED.assigned_to, 
    status_active = EXCLUDED.status_active, 
    vgp_status = EXCLUDED.vgp_status, 
    vgp_observations = EXCLUDED.vgp_observations, 
    next_maintenance_date = EXCLUDED.next_maintenance_date, 
    last_vgp_date = EXCLUDED.last_vgp_date;