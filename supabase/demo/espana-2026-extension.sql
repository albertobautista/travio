-- Extends the demo trip "España 2026" with three more cities after Málaga:
-- Granada (11–13 oct), Valencia (13–16 oct) and San Sebastián (16–19 oct).
-- The trip now ends on 19 oct: the return flights leave from San Sebastián.
--
-- Run it once, after espana-2026.sql, as the trip's owner:
--   docker exec -i supabase_db_travio psql -U postgres -v ON_ERROR_STOP=1 \
--     -v owner_email=you@example.com < supabase/demo/espana-2026-extension.sql
--
-- Like the main script, everything runs AS the owner (role authenticated +
-- JWT claims), so RLS, defaults and triggers apply as in the app.
begin;

create temp table ids (key text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- The owner's latest "España 2026" (resolved before switching roles).
insert into ids
select 'trip', t.id
from public.trips t
join public.trip_members m on m.trip_id = t.id and m.role = 'owner'
join auth.users u on u.id = m.user_id
where u.email = :'owner_email' and t.name = 'España 2026'
order by t.created_at desc
limit 1;

select set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true)
from auth.users u where u.email = :'owner_email';

do $$
begin
  if not exists (select 1 from ids where key = 'trip') then
    raise exception 'No "España 2026" owned by that email: run espana-2026.sql first';
  end if;
  if exists (select 1 from public.trip_stops s join ids on ids.id = s.trip_id and ids.key = 'trip' where s.name = 'Granada') then
    raise exception 'This trip already has Granada: the extension was already applied';
  end if;
end $$;

set local role authenticated;

insert into ids select 'alberto', t.id from public.travelers t join ids on ids.id = t.trip_id and ids.key = 'trip' where t.user_id is not null limit 1;
insert into ids select 'ximena', t.id from public.travelers t join ids on ids.id = t.trip_id and ids.key = 'trip' where t.name = 'Ximena';

-- ---------------------------------------------------------------------------
-- The trip: 23 days now, and more budget
-- ---------------------------------------------------------------------------
update public.trips set
  end_date = '2026-10-19',
  budget_amount = 215000,
  description = 'Barcelona, Madrid, Sevilla, Málaga, Granada, Valencia y San Sebastián en 23 días. Trenes AVE, excursiones a Montserrat, Toledo, Ronda, Nerja, la Albufera y Getaria.'
where id = (select id from ids where key = 'trip');

-- Málaga is no longer the last stop: a normal check-out instead of leaving at dawn.
update public.accommodations set
  check_out_at = '2026-10-11 10:00'::timestamp at time zone 'Europe/Madrid',
  notes = 'Dejamos el hotel a las 10:00 para el bus a Granada.'
where trip_id = (select id from ids where key = 'trip') and name = 'Molina Lario Hotel';

-- The way home moves to 19 oct, from San Sebastián (same booking reference).
update public.transportations set
  origin_name = 'San Sebastián (EAS)',
  departs_at = '2026-10-19 07:05'::timestamp at time zone 'Europe/Madrid',
  arrives_at = '2026-10-19 08:20'::timestamp at time zone 'Europe/Madrid',
  departure_detail = 'Aeropuerto de Hondarribia · terminal única',
  notes = 'Conexión en Madrid: 3 h 45 min.'
where trip_id = (select id from ids where key = 'trip') and service_number = 'IB 3999';

update public.transportations set
  departs_at = '2026-10-19 12:05'::timestamp at time zone 'Europe/Madrid',
  arrives_at = '2026-10-19 16:10'::timestamp at time zone 'America/Mexico_City',
  notes = 'Mismo localizador que el vuelo EAS–MAD.'
where trip_id = (select id from ids where key = 'trip') and service_number = 'IB 6403';

-- ---------------------------------------------------------------------------
-- Stops (the trigger appends them after Málaga)
-- ---------------------------------------------------------------------------
insert into public.trip_stops (trip_id, name, timezone, arrives_on, departs_on, notes, lat, lng)
select ids.id, s.name, 'Europe/Madrid', s.arrives::date, s.departs::date, s.notes, s.lat, s.lng
from ids, (values
  ('Granada',       '2026-10-11', '2026-10-13', 'La Alhambra, el Albaicín y tapas gratis con cada caña.', 37.1773, -3.5986),
  ('Valencia',      '2026-10-13', '2026-10-16', 'Paella, Ciudad de las Artes y la Albufera.', 39.4699, -0.3763),
  ('San Sebastián', '2026-10-16', '2026-10-19', 'Pintxos, La Concha y excursión a Getaria.', 43.3183, -1.9812)
) as s(name, arrives, departs, notes, lat, lng)
where ids.key = 'trip';

insert into ids
select case s.name when 'San Sebastián' then 'donostia' else lower(s.name) end, s.id
from public.trip_stops s join ids on ids.id = s.trip_id and ids.key = 'trip'
where s.name in ('Granada', 'Valencia', 'San Sebastián');

-- ---------------------------------------------------------------------------
-- Accommodations
-- ---------------------------------------------------------------------------
insert into public.accommodations
  (trip_id, trip_stop_id, name, address, check_in_at, check_out_at, timezone, booking_ref, booking_url, booking_status, cost_amount, cost_currency, notes, lat, lng)
select trip.id, stop.id, a.name, a.address,
  a.check_in::timestamp at time zone 'Europe/Madrid',
  a.check_out::timestamp at time zone 'Europe/Madrid',
  'Europe/Madrid', a.ref, a.url, 'confirmed', a.cost, 'EUR', a.notes, a.lat, a.lng
from (values
  ('granada', 'Hotel Casa 1800 Granada', 'Calle Benalúa, 11, 18010 Granada',
   '2026-10-11 14:00', '2026-10-13 09:00', 'BK-6650192', 'https://www.booking.com', 310.00,
   'En el Albaicín bajo, a 3 min de Plaza Nueva. Pedir habitación con vista a la Alhambra.', 37.1782, -3.5932),
  ('valencia', 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València',
   '2026-10-13 15:00', '2026-10-16 08:00', 'BK-7012384', 'https://www.booking.com', 585.00,
   'Palacio del siglo XIX con restos de la muralla árabe en el comedor.', 39.4772, -0.3742),
  ('donostia', 'Hotel de Londres y de Inglaterra', 'Zubieta Kalea, 2, 20007 Donostia',
   '2026-10-16 15:00', '2026-10-19 05:00', 'EXP-81200457', 'https://www.expedia.com', 720.00,
   'Frente a La Concha. Salimos de madrugada al aeropuerto: pagar todo la noche anterior.', 43.3179, -1.9855)
) as a(stop_key, name, address, check_in, check_out, ref, url, cost, notes, lat, lng)
join ids stop on stop.key = a.stop_key
join ids trip on trip.key = 'trip';

-- ---------------------------------------------------------------------------
-- Transportation between the new cities
-- ---------------------------------------------------------------------------
insert into public.transportations
  (trip_id, type, origin_name, destination_name, departs_at, departs_timezone, arrives_at, arrives_timezone,
   carrier, service_number, booking_ref, booking_url, booking_status, departure_detail, arrival_detail, cost_amount, cost_currency, notes)
select trip.id, l.type, l.origin, l.destination,
  l.departs::timestamp at time zone 'Europe/Madrid', 'Europe/Madrid',
  l.arrives::timestamp at time zone 'Europe/Madrid', 'Europe/Madrid',
  l.carrier, l.number, l.ref, l.url, 'confirmed', l.dep_detail, l.arr_detail, l.cost, 'EUR', l.notes
from (values
  ('bus', 'Málaga · Estación de autobuses', 'Granada · Estación de autobuses', '2026-10-11 10:30', '2026-10-11 12:15',
   'ALSA', '7105', 'ALS-10233', 'https://www.alsa.es', 'Andén 8', null, 26.40, null),
  ('flight', 'Granada (GRX)', 'Valencia (VLC)', '2026-10-13 11:10', '2026-10-13 12:25',
   'Vueling', 'VY 2215', 'VYQ8ZT', 'https://www.vueling.com', 'Terminal única', 'Terminal 1', 148.00,
   'Tarifa Optima: 1 maleta documentada de 25 kg para los dos.'),
  ('flight', 'Valencia (VLC)', 'Bilbao (BIO)', '2026-10-16 10:15', '2026-10-16 11:30',
   'Vueling', 'VY 1489', 'VYM2KD', 'https://www.vueling.com', 'Terminal 1', 'Terminal única', 162.00, null),
  ('bus', 'Bilbao · Aeropuerto', 'San Sebastián · Estación de autobuses', '2026-10-16 12:00', '2026-10-16 13:15',
   'PESA', 'Bizkaibus A3', 'PESA-55102', 'https://www.pesa.net', 'Parada frente a llegadas', 'Estación de Donostia (Atotxa)', 34.00,
   'Sale cada hora; si el vuelo se retrasa, tomar el siguiente.')
) as l(type, origin, destination, departs, arrives, carrier, number, ref, url, dep_detail, arr_detail, cost, notes)
join ids trip on trip.key = 'trip';

select public.set_transportation_participants(tr.id, jsonb_build_array(
  jsonb_build_object('traveler_id', (select id from ids where key = 'alberto'), 'seat', s.a),
  jsonb_build_object('traveler_id', (select id from ids where key = 'ximena'), 'seat', s.x)
))
from public.transportations tr
join ids trip on trip.key = 'trip' and tr.trip_id = trip.id
join (values ('7105', '21', '22'), ('VY 2215', '9C', '9D'), ('VY 1489', '14A', '14B')) as s(num, a, x)
  on s.num = tr.service_number;

-- ---------------------------------------------------------------------------
-- Activities (local Europe/Madrid). Transfers have no coordinates: they
-- aren't a place.
-- ---------------------------------------------------------------------------
insert into public.activities
  (trip_id, trip_stop_id, title, category, starts_at, duration_minutes, timezone, location_name, address,
   booking_status, reservation_ref, cost_amount, cost_currency, notes, lat, lng)
select trip.id, s.id, a.title, a.category,
  a.starts::timestamp at time zone 'Europe/Madrid', a.minutes, 'Europe/Madrid', a.place, a.address,
  a.status, a.ref, a.cost, case when a.cost is null then null else 'EUR' end, a.notes, a.lat, a.lng
from (values
  -- ── Málaga → Granada · dom 11 oct ───────────────────────────────────────
  ('Málaga', 'Desayuno en Café Central', 'food', '2026-10-11 08:45', 45, 'Café Central', 'Plaza de la Constitución, 11, Málaga', 'planned', null, null, 'Pedir un "mitad" (café con leche a partes iguales).', 36.7206, -4.4206),
  ('Málaga', 'Taxi a la estación de autobuses', 'transfer', '2026-10-11 10:00', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Granada', 'Taxi al hotel', 'transfer', '2026-10-11 12:30', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Granada', 'Comida en Bodegas Castañeda', 'food', '2026-10-11 13:15', 75, 'Bodegas Castañeda', 'Calle Almireceros, 1, 18010 Granada', 'planned', null, null, 'Cada bebida trae su tapa gratis.', 37.1767, -3.5980),
  ('Granada', 'Check-in y descanso', 'free_time', '2026-10-11 14:45', 75, 'Hotel Casa 1800 Granada', 'Calle Benalúa, 11, 18010 Granada', 'planned', null, null, null, 37.1782, -3.5932),
  ('Granada', 'Caminar al Albaicín', 'transfer', '2026-10-11 16:15', 20, 'A pie por la Carrera del Darro', null, 'planned', null, null, null, null, null),
  ('Granada', 'Paseo por el Albaicín', 'sightseeing', '2026-10-11 16:45', 105, 'Albaicín', 'Albaicín, Granada', 'planned', null, null, 'Perderse por las callejuelas; Plaza Larga y el Arco de las Pesas.', 37.1810, -3.5920),
  ('Granada', 'Atardecer en el Mirador de San Nicolás', 'sightseeing', '2026-10-11 18:45', 60, 'Mirador de San Nicolás', 'Plaza de San Nicolás, 18010 Granada', 'planned', null, null, 'La vista clásica de la Alhambra con Sierra Nevada detrás.', 37.1811, -3.5926),
  ('Granada', 'Caminar al Sacromonte', 'transfer', '2026-10-11 20:00', 15, 'A pie por el Camino del Sacromonte', null, 'planned', null, null, null, null, null),
  ('Granada', 'Zambra flamenca en Cueva de la Rocío', 'nightlife', '2026-10-11 20:30', 90, 'Cueva de la Rocío', 'Camino del Sacromonte, 70, 18010 Granada', 'confirmed', 'CR-1120', 60.00, 'Flamenco en una cueva del Sacromonte.', 37.1798, -3.5868),
  ('Granada', 'Tapas en la Calle Navas', 'food', '2026-10-11 22:15', 75, 'Calle Navas', 'Calle Navas, 18009 Granada', 'planned', null, null, 'Los Diamantes II o Bar Poë.', 37.1739, -3.5995),
  -- ── Granada · lun 12 oct ────────────────────────────────────────────────
  ('Granada', 'Desayuno en el hotel', 'food', '2026-10-12 07:45', 30, 'Hotel Casa 1800 Granada', 'Calle Benalúa, 11, 18010 Granada', 'planned', null, null, null, 37.1782, -3.5932),
  ('Granada', 'Bus C30 a la Alhambra', 'transfer', '2026-10-12 08:15', 20, 'Bus C30 desde Plaza Isabel la Católica', null, 'planned', null, null, null, null, null),
  ('Granada', 'Alhambra y Palacios Nazaríes', 'tour', '2026-10-12 08:45', 240, 'La Alhambra', 'Calle Real de la Alhambra, s/n, 18009 Granada', 'confirmed', 'ALH-55120931', 39.40, 'Entrada a los Nazaríes a las 09:30 en punto. Llevar pasaporte: lo piden en el acceso.', 37.1761, -3.5881),
  ('Granada', 'Bajar por la Cuesta de Gomérez', 'transfer', '2026-10-12 13:00', 25, 'A pie por la Cuesta de Gomérez', null, 'planned', null, null, null, null, null),
  ('Granada', 'Comida en Los Diamantes', 'food', '2026-10-12 13:45', 75, 'Los Diamantes', 'Plaza Nueva, 13, 18010 Granada', 'planned', null, null, 'Fritura de pescado; hay fila después de las 14:00.', 37.1766, -3.5958),
  ('Granada', 'Catedral y Capilla Real', 'sightseeing', '2026-10-12 15:15', 90, 'Catedral de Granada', 'Calle Gran Vía de Colón, 5, 18001 Granada', 'planned', null, 14.00, 'En la Capilla Real están los Reyes Católicos.', 37.1763, -3.5990),
  ('Granada', 'Té en la Calle Calderería', 'food', '2026-10-12 17:00', 60, 'Calle Calderería Nueva', 'Calle Calderería Nueva, 18010 Granada', 'planned', null, null, 'Teterías y puestos de la antigua Alcaicería.', 37.1784, -3.5965),
  ('Granada', 'Descanso en el hotel', 'free_time', '2026-10-12 18:15', 105, 'Hotel Casa 1800 Granada', 'Calle Benalúa, 11, 18010 Granada', 'planned', null, null, null, 37.1782, -3.5932),
  ('Granada', 'Taxi al Realejo', 'transfer', '2026-10-12 20:15', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Granada', 'Cena en Carmen de San Miguel', 'food', '2026-10-12 20:45', 90, 'Carmen de San Miguel', 'Plaza de Torres Bermejas, 3, 18009 Granada', 'booked', 'CSM-0412', null, 'Terraza con vista a la Alhambra iluminada.', 37.1749, -3.5914),
  -- ── Granada → Valencia · mar 13 oct ─────────────────────────────────────
  ('Granada', 'Desayuno en el hotel', 'food', '2026-10-13 08:00', 30, 'Hotel Casa 1800 Granada', 'Calle Benalúa, 11, 18010 Granada', 'planned', null, null, null, 37.1782, -3.5932),
  ('Granada', 'Taxi al aeropuerto de Granada', 'transfer', '2026-10-13 09:15', 30, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Metro L3 al centro', 'transfer', '2026-10-13 12:45', 30, 'Metrovalencia L3', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Comida en el Mercado Central', 'food', '2026-10-13 13:30', 75, 'Mercado Central', 'Plaça de la Ciutat de Bruges, 46001 València', 'planned', null, null, 'Central Bar de Ricard Camarena, dentro del mercado.', 39.4736, -0.3790),
  ('Valencia', 'La Lonja de la Seda', 'sightseeing', '2026-10-13 15:00', 45, 'La Lonja de la Seda', 'Carrer de la Llotja, 2, 46001 València', 'planned', null, 4.00, 'Patrimonio de la Humanidad; la sala de columnas.', 39.4743, -0.3785),
  ('Valencia', 'Check-in y descanso', 'free_time', '2026-10-13 16:00', 60, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'Catedral y subida al Miguelete', 'sightseeing', '2026-10-13 17:15', 75, 'Catedral de Valencia', 'Plaça de l''Almoina, s/n, 46003 València', 'planned', null, 18.00, 'El Santo Cáliz y 207 escalones hasta arriba.', 39.4755, -0.3752),
  ('Valencia', 'Paseo por el Barrio del Carmen', 'sightseeing', '2026-10-13 18:45', 75, 'Barrio del Carmen', 'El Carme, València', 'planned', null, null, 'Arte urbano y la Plaza del Tossal.', 39.4787, -0.3810),
  ('Valencia', 'Horchata y fartons en Santa Catalina', 'food', '2026-10-13 20:05', 30, 'Horchatería Santa Catalina', 'Plaça de Santa Caterina, 6, 46001 València', 'planned', null, null, null, 39.4750, -0.3772),
  ('Valencia', 'Taxi al Cabanyal', 'transfer', '2026-10-13 20:40', 20, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Cena en Bodega Casa Montaña', 'food', '2026-10-13 21:15', 90, 'Bodega Casa Montaña', 'Carrer de Josep Benlliure, 69, 46011 València', 'booked', 'CM-1310', null, 'Taberna de 1836; pedir las habas con jamón.', 39.4655, -0.3302),
  -- ── Valencia · mié 14 oct ───────────────────────────────────────────────
  ('Valencia', 'Desayuno en el hotel', 'food', '2026-10-14 08:30', 30, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'En bici por el Jardín del Turia', 'sightseeing', '2026-10-14 09:15', 45, 'Jardí del Túria', 'Jardí del Túria, València', 'planned', null, 12.00, 'Valenbisi hasta la Ciudad de las Artes.', 39.4700, -0.3640),
  ('Valencia', 'Oceanogràfic', 'sightseeing', '2026-10-14 10:15', 180, 'L''Oceanogràfic', 'Carrer d''Eduardo Primo Yúfera, 1B, 46013 València', 'confirmed', 'OCE-771203', 75.40, 'El acuario más grande de Europa.', 39.4527, -0.3471),
  ('Valencia', 'Taxi a la Malvarrosa', 'transfer', '2026-10-14 13:30', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Paella en Casa Carmela', 'food', '2026-10-14 14:00', 105, 'Casa Carmela', 'Carrer d''Isabel de Villena, 155, 46011 València', 'booked', 'CC-1410', null, 'Paella valenciana a leña desde 1922.', 39.4769, -0.3245),
  ('Valencia', 'Paseo por la playa de la Malvarrosa', 'free_time', '2026-10-14 16:00', 75, 'Playa de la Malvarrosa', 'Passeig Marítim, València', 'planned', null, null, null, 39.4790, -0.3240),
  ('Valencia', 'Tranvía al hotel', 'transfer', '2026-10-14 17:30', 35, 'Tranvía L4 + a pie', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Descanso en el hotel', 'free_time', '2026-10-14 18:10', 80, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'Taxi a la Ciudad de las Artes', 'transfer', '2026-10-14 19:35', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Ciudad de las Artes y las Ciencias de noche', 'sightseeing', '2026-10-14 19:50', 60, 'Ciudad de las Artes y las Ciencias', 'Av. del Professor López Piñero, 7, 46013 València', 'planned', null, null, 'Los edificios iluminados reflejados en el agua.', 39.4549, -0.3507),
  ('Valencia', 'Taxi al centro', 'transfer', '2026-10-14 20:55', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Cena en Canalla Bistro', 'food', '2026-10-14 21:15', 90, 'Canalla Bistro', 'Carrer del Mar, 45, 46003 València', 'booked', 'CB-1421', null, null, 39.4718, -0.3720),
  -- ── Valencia · jue 15 oct ───────────────────────────────────────────────
  ('Valencia', 'Desayuno en el hotel', 'food', '2026-10-15 08:15', 30, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'Caminar a la Plaza de la Reina', 'transfer', '2026-10-15 09:00', 15, 'A pie', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Albufera: paseo en barca y El Palmar', 'tour', '2026-10-15 09:30', 240, 'El Palmar', 'El Palmar, València', 'confirmed', 'CVT-AL-4410', 64.00, 'Salida en bus desde la Plaza de la Reina; barca por el lago y arrozales.', 39.3134, -0.3261),
  ('Valencia', 'Arroz en Restaurante Bon Aire', 'food', '2026-10-15 13:45', 90, 'Restaurante Bon Aire', 'Carrer de Caudillo, 18, El Palmar, València', 'booked', 'BA-1545', null, 'Arroz con all i pebre de anguila.', 39.3136, -0.3255),
  ('Valencia', 'Bus de regreso a Valencia', 'transfer', '2026-10-15 15:30', 40, 'Bus del tour', null, 'planned', null, null, null, null, null),
  ('Valencia', 'Torres de Serranos', 'sightseeing', '2026-10-15 16:30', 45, 'Torres de Serranos', 'Plaça dels Furs, s/n, 46003 València', 'planned', null, 2.00, 'Subir a la terraza: vista del Turia.', 39.4791, -0.3759),
  ('Valencia', 'Compras en la calle Colón', 'shopping', '2026-10-15 17:30', 90, 'Carrer de Colón', 'Carrer de Colón, València', 'planned', null, null, null, 39.4695, -0.3720),
  ('Valencia', 'Maletas y descanso', 'free_time', '2026-10-15 19:15', 90, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'Cena en La Utielana', 'food', '2026-10-15 21:00', 75, 'La Utielana', 'Plaça del Picadero dos Aguas, 3, 46002 València', 'planned', null, null, 'Casa de comidas sencilla y muy local.', 39.4713, -0.3784),
  -- ── Valencia → San Sebastián · vie 16 oct ───────────────────────────────
  ('Valencia', 'Desayuno rápido en el hotel', 'food', '2026-10-16 07:30', 30, 'Caro Hotel', 'Carrer de l''Almirall, 14, 46003 València', 'planned', null, null, null, 39.4772, -0.3742),
  ('Valencia', 'Taxi al aeropuerto de Valencia', 'transfer', '2026-10-16 08:15', 25, 'Taxi', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Caminar al hotel', 'transfer', '2026-10-16 13:20', 20, 'A pie por la orilla del Urumea', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Pintxos de bienvenida en Txepetxa', 'food', '2026-10-16 14:00', 75, 'Bar Txepetxa', 'Pescadería Kalea, 5, 20003 Donostia', 'planned', null, null, 'Famosos por la anchoa con gilda.', 43.3229, -1.9852),
  ('San Sebastián', 'Check-in y descanso', 'free_time', '2026-10-16 15:30', 45, 'Hotel de Londres y de Inglaterra', 'Zubieta Kalea, 2, 20007 Donostia', 'planned', null, null, null, 43.3179, -1.9855),
  ('San Sebastián', 'Paseo por la Bahía de La Concha', 'sightseeing', '2026-10-16 16:30', 75, 'Playa de La Concha', 'Kontxa Pasealekua, 20007 Donostia', 'planned', null, null, 'La barandilla blanca, de punta a punta.', 43.3170, -1.9880),
  ('San Sebastián', 'Funicular y Monte Igueldo', 'sightseeing', '2026-10-16 18:00', 90, 'Monte Igueldo', 'Igeldo Pasealekua, 20008 Donostia', 'planned', null, 8.50, 'Funicular de 1912 y el parque de atracciones antiguo.', 43.3215, -2.0055),
  ('San Sebastián', 'Bus 16 de regreso al centro', 'transfer', '2026-10-16 19:35', 20, 'Bus Dbus 16', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Ruta de pintxos en la Parte Vieja', 'food', '2026-10-16 20:30', 120, 'Parte Vieja', 'Abuztuaren 31 Kalea, 20003 Donostia', 'planned', null, null, 'Gandarias, Borda Berri y La Cuchara de San Telmo.', 43.3235, -1.9850),
  -- ── San Sebastián · sáb 17 oct ──────────────────────────────────────────
  ('San Sebastián', 'Desayuno en Pastelería Otaegui', 'food', '2026-10-17 09:00', 45, 'Pastelería Otaegui', 'Narrika Kalea, 15, 20003 Donostia', 'planned', null, null, 'La pastelería más antigua de la ciudad (1886).', 43.3227, -1.9846),
  ('San Sebastián', 'Subida al Monte Urgull', 'sightseeing', '2026-10-17 10:00', 105, 'Monte Urgull', 'Paseo Nuevo, 20003 Donostia', 'planned', null, null, 'El Castillo de la Mota y el Sagrado Corazón.', 43.3245, -1.9890),
  ('San Sebastián', 'San Telmo Museoa', 'sightseeing', '2026-10-17 12:00', 90, 'San Telmo Museoa', 'Zuloaga Plaza, 1, 20003 Donostia', 'planned', null, 13.00, 'Historia vasca en un convento del siglo XVI.', 43.3245, -1.9838),
  ('San Sebastián', 'Comida en Bar Nestor', 'food', '2026-10-17 13:45', 75, 'Bar Nestor', 'Pescadería Kalea, 11, 20003 Donostia', 'planned', null, null, 'Solo 2 tortillas al día: apuntarse a las 11:30 para la de las 13:00.', 43.3232, -1.9849),
  ('San Sebastián', 'Tarta de queso en La Viña', 'food', '2026-10-17 15:10', 30, 'La Viña', 'Abuztuaren 31 Kalea, 3, 20003 Donostia', 'planned', null, null, 'La tarta de queso original.', 43.3241, -1.9850),
  ('San Sebastián', 'Descanso en el hotel', 'free_time', '2026-10-17 15:50', 90, 'Hotel de Londres y de Inglaterra', 'Zubieta Kalea, 2, 20007 Donostia', 'planned', null, null, null, 43.3179, -1.9855),
  ('San Sebastián', 'Caminar al Peine del Viento', 'transfer', '2026-10-17 17:40', 40, 'A pie por Ondarreta', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Atardecer en el Peine del Viento', 'sightseeing', '2026-10-17 18:30', 60, 'El Peine del Viento', 'Eduardo Chillida Pasealekua, 20008 Donostia', 'planned', null, null, 'Esculturas de Chillida contra las olas.', 43.3216, -2.0063),
  ('San Sebastián', 'Taxi a Gros', 'transfer', '2026-10-17 19:45', 15, 'Taxi', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Pintxos en Bar Bergara', 'food', '2026-10-17 20:15', 90, 'Bar Bergara', 'General Arteche Kalea, 8, 20002 Donostia', 'planned', null, null, 'El barrio de Gros, con menos turistas.', 43.3233, -1.9772),
  -- ── Getaria · dom 18 oct ────────────────────────────────────────────────
  ('San Sebastián', 'Desayuno en el hotel', 'food', '2026-10-18 08:45', 30, 'Hotel de Londres y de Inglaterra', 'Zubieta Kalea, 2, 20007 Donostia', 'planned', null, null, null, 43.3179, -1.9855),
  ('San Sebastián', 'Bus Lurraldebus a Getaria', 'transfer', '2026-10-18 09:30', 45, 'Lurraldebus desde Plaza Gipuzkoa', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Museo Cristóbal Balenciaga', 'sightseeing', '2026-10-18 10:30', 90, 'Cristóbal Balenciaga Museoa', 'Aldamar Parkea, 6, 20808 Getaria', 'planned', null, 14.00, 'En el pueblo natal del diseñador.', 43.3018, -2.2045),
  ('San Sebastián', 'Paseo por el puerto y el Ratón de Getaria', 'sightseeing', '2026-10-18 12:15', 60, 'Puerto de Getaria', 'Getaria', 'planned', null, null, null, 43.3048, -2.2041),
  ('San Sebastián', 'Rodaballo a la parrilla en Elkano', 'food', '2026-10-18 13:30', 120, 'Restaurante Elkano', 'Herrerieta Kalea, 2, 20808 Getaria', 'booked', 'ELK-1810', 190.00, 'Uno de los mejores asadores de pescado del mundo.', 43.3035, -2.2050),
  ('San Sebastián', 'Cata de txakoli en Txomin Etxaniz', 'food', '2026-10-18 15:45', 75, 'Txomin Etxaniz', 'Txomin Etxaniz, 20808 Getaria', 'booked', 'TXE-188', 30.00, 'Viñedos frente al mar.', 43.2955, -2.2105),
  ('San Sebastián', 'Bus de regreso a San Sebastián', 'transfer', '2026-10-18 17:15', 45, 'Lurraldebus', null, 'planned', null, null, null, null, null),
  ('San Sebastián', 'Maletas y descanso', 'free_time', '2026-10-18 18:15', 105, 'Hotel de Londres y de Inglaterra', 'Zubieta Kalea, 2, 20007 Donostia', 'planned', null, null, 'Pagar el hotel: salimos a las 05:00.', 43.3179, -1.9855),
  ('San Sebastián', 'Cena de despedida en Ganbara', 'food', '2026-10-18 20:30', 90, 'Bar Ganbara', 'San Jeronimo Kalea, 21, 20003 Donostia', 'booked', 'GB-1830', null, 'Hongos a la plancha con yema.', 43.3236, -1.9844),
  -- ── Regreso · lun 19 oct ────────────────────────────────────────────────
  ('San Sebastián', 'Taxi al aeropuerto de San Sebastián', 'transfer', '2026-10-19 05:15', 25, 'Taxi a Hondarribia', null, 'planned', null, null, 'Reservado la noche anterior en recepción.', null, null)
) as a(city, title, category, starts, minutes, place, address, status, ref, cost, notes, lat, lng)
join ids trip on trip.key = 'trip'
join public.trip_stops s on s.trip_id = trip.id and s.name = a.city;

-- ---------------------------------------------------------------------------
-- Saved places: ideas not in the plan yet
-- ---------------------------------------------------------------------------
insert into public.saved_places (trip_id, trip_stop_id, name, category, address, lat, lng, estimated_minutes, external_url, notes)
select trip.id, s.id, p.name, p.category, p.address, p.lat, p.lng, p.minutes, p.url, p.notes
from (values
  ('Granada', 'Hammam Al Ándalus', 'other', 'Calle Santa Ana, 16, 18009 Granada', 37.1772, -3.5946, 90, 'https://granada.hammamalandalus.com', 'Baños árabes; reservar con un día de anticipación.'),
  ('Granada', 'Mirador de San Cristóbal', 'sightseeing', 'Carretera de Murcia, 18010 Granada', 37.1845, -3.5952, 30, null, 'Menos gente que San Nicolás.'),
  ('Valencia', 'Museo de Bellas Artes', 'sightseeing', 'Carrer de Sant Pius V, 9, 46010 València', 39.4795, -0.3721, 90, null, 'Gratis; Sorolla y Goya.'),
  ('Valencia', 'Mercado de Colón', 'food', 'Carrer de Jorge Juan, 19, 46004 València', 39.4695, -0.3683, 45, null, 'Modernista; buen sitio para una horchata.'),
  ('San Sebastián', 'Isla de Santa Clara', 'sightseeing', 'Bahía de La Concha, Donostia', 43.3204, -1.9971, 120, null, 'Barco desde el puerto cada 30 min (solo con buen tiempo).'),
  ('San Sebastián', 'Borda Berri', 'food', 'Fermin Calbeton Kalea, 12, 20003 Donostia', 43.3239, -1.9851, 45, null, 'Pintxos calientes: carrillera y risotto de hongos.'),
  ('San Sebastián', 'Tabakalera', 'other', 'Andre Zigarrogileen Plaza, 1, 20012 Donostia', 43.3178, -1.9768, 60, null, 'Centro de cultura; terraza en la azotea.')
) as p(city, name, category, address, lat, lng, minutes, url, notes)
join ids trip on trip.key = 'trip'
join public.trip_stops s on s.trip_id = trip.id and s.name = p.city;

-- ---------------------------------------------------------------------------
-- Budget: bookings already paid for the new part
-- ---------------------------------------------------------------------------
insert into public.expenses (trip_id, category, description, amount, currency, spent_on, paid_by, notes)
select trip.id, e.category, e.description, e.amount, 'EUR', e.spent_on::date, (select id from ids where key = e.payer), e.notes
from (values
  ('flights', 'Vuelos Vueling GRX–VLC y VLC–BIO', 310.00, '2026-08-22', 'alberto', null),
  ('accommodation', 'Caro Hotel (3 noches)', 585.00, '2026-08-25', 'ximena', 'Pagado por adelantado con descuento.'),
  ('activities', 'Entradas Alhambra (2)', 39.40, '2026-07-30', 'alberto', 'Se agotan con meses de anticipación.')
) as e(category, description, amount, spent_on, payer, notes)
join ids trip on trip.key = 'trip';

-- Summary
select
  (select count(*) from public.trip_stops where trip_id = (select id from ids where key = 'trip')) as stops,
  (select count(*) from public.accommodations where trip_id = (select id from ids where key = 'trip')) as stays,
  (select count(*) from public.transportations where trip_id = (select id from ids where key = 'trip')) as legs,
  (select count(*) from public.activities where trip_id = (select id from ids where key = 'trip')) as activities,
  (select count(*) from public.saved_places where trip_id = (select id from ids where key = 'trip')) as saved_places;

commit;
