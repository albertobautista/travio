-- Demo trip "España 2026": Barcelona, Madrid, Sevilla y Málaga, 15 days
-- (27 sep – 11 oct 2026), 2 travelers, 4 stays, 7 legs with seats and
-- 125 activities including in-city transfers.
--
-- Usage (see supabase/demo/README.md):
--   docker exec -i supabase_db_travio psql -U postgres -v ON_ERROR_STOP=1 \
--     -v owner_email=you@example.com < supabase/demo/espana-2026.sql
--
-- Everything is inserted AS the owner (role authenticated + their JWT claims),
-- so RLS, defaults and triggers behave exactly as in the app: the trip gets
-- its owner membership and first traveler from the triggers.
begin;

create temp table ids (key text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- Resolve the owner before switching roles (auth.users isn't readable after).
select set_config(
  'request.jwt.claims',
  json_build_object('sub', u.id, 'role', 'authenticated')::text,
  true
)
from auth.users u
where u.email = :'owner_email';

do $$
begin
  if nullif(current_setting('request.jwt.claims', true), '') is null then
    raise exception 'No user with that email: pass -v owner_email=<an existing account>';
  end if;
end $$;

set local role authenticated;

-- Trip (triggers add Alberto as owner and as the first traveler)
with t as (
  insert into public.trips (name, description, start_date, end_date, currency, budget_amount)
  values (
    'España 2026',
    'Barcelona, Madrid, Sevilla y Málaga en 15 días. Trenes AVE entre ciudades, excursiones a Montserrat, Toledo, Ronda y Nerja.',
    '2026-09-27', '2026-10-11', 'MXN', 95000
  )
  returning id
)
insert into ids select 'trip', id from t;

-- Second traveler (no account needed)
insert into public.travelers (trip_id, name, color)
select id, 'Ximena', 'pink' from ids where key = 'trip';

insert into ids select 'alberto', t.id from public.travelers t join ids on ids.id = t.trip_id and ids.key = 'trip' where t.user_id is not null;
insert into ids select 'ximena', t.id from public.travelers t join ids on ids.id = t.trip_id and ids.key = 'trip' where t.name = 'Ximena';

-- Stops (the trigger appends them in route order)
insert into public.trip_stops (trip_id, name, timezone, arrives_on, departs_on, notes)
select ids.id, s.name, 'Europe/Madrid', s.arrives::date, s.departs::date, s.notes
from ids, (values
  ('Barcelona', '2026-09-28', '2026-10-02', 'Gaudí, Barrio Gótico y playa.'),
  ('Madrid',    '2026-10-02', '2026-10-05', 'Museos y excursión a Toledo.'),
  ('Sevilla',   '2026-10-05', '2026-10-08', 'Alcázar, Catedral y flamenco.'),
  ('Málaga',    '2026-10-08', '2026-10-11', 'Base para Ronda y Nerja.')
) as s(name, arrives, departs, notes)
where ids.key = 'trip';

insert into ids select lower(s.name), s.id from public.trip_stops s join ids on ids.id = s.trip_id and ids.key = 'trip';

-- ---------------------------------------------------------------------------
-- Accommodations (local times in Europe/Madrid)
-- ---------------------------------------------------------------------------
insert into public.accommodations
  (trip_id, trip_stop_id, name, address, check_in_at, check_out_at, timezone, booking_ref, booking_url, booking_status, cost_amount, cost_currency, notes)
select trip.id, stop.id, a.name, a.address,
  a.check_in::timestamp at time zone 'Europe/Madrid',
  a.check_out::timestamp at time zone 'Europe/Madrid',
  'Europe/Madrid', a.ref, a.url, 'confirmed', a.cost, 'EUR', a.notes
from (values
  ('barcelona', 'Casa Bonay', 'Gran Via de les Corts Catalanes, 700, 08010 Barcelona',
   '2026-09-28 15:00', '2026-10-02 09:00', 'BK-4821937', 'https://www.booking.com', 612.00,
   'Habitación doble con terraza. Desayuno incluido.'),
  ('madrid', 'Only YOU Boutique Hotel Madrid', 'Calle del Barquillo, 21, 28004 Madrid',
   '2026-10-02 15:00', '2026-10-05 08:00', 'BK-5530218', 'https://www.booking.com', 489.00,
   'A 10 min a pie de Gran Vía. Guardan maletas si llegamos antes.'),
  ('sevilla', 'Hotel Casa 1800 Sevilla', 'Calle Rodrigo Caro, 6, 41004 Sevilla',
   '2026-10-05 14:00', '2026-10-08 09:30', 'EXP-77310452', 'https://www.expedia.com', 540.00,
   'Terraza con vista a la Giralda. Merienda de cortesía 17:00–20:00.'),
  ('málaga', 'Molina Lario Hotel', 'Calle Molina Lario, 20, 29015 Málaga',
   '2026-10-08 15:00', '2026-10-11 05:00', 'BK-6104775', 'https://www.booking.com', 438.00,
   'Salimos de madrugada al aeropuerto: pagar todo la noche anterior.')
) as a(stop_key, name, address, check_in, check_out, ref, url, cost, notes)
join ids stop on stop.key = a.stop_key
join ids trip on trip.key = 'trip';

-- ---------------------------------------------------------------------------
-- Transportation (each end in its own zone)
-- ---------------------------------------------------------------------------
insert into public.transportations
  (trip_id, type, origin_name, destination_name, departs_at, departs_timezone, arrives_at, arrives_timezone,
   carrier, service_number, booking_ref, booking_url, booking_status, departure_detail, arrival_detail, cost_amount, cost_currency, notes)
select trip.id, l.type, l.origin, l.destination,
  l.departs::timestamp at time zone l.dep_tz, l.dep_tz,
  l.arrives::timestamp at time zone l.arr_tz, l.arr_tz,
  l.carrier, l.number, l.ref, l.url, 'confirmed', l.dep_detail, l.arr_detail, l.cost, l.currency, l.notes
from (values
  ('flight', 'Ciudad de México (MEX)', 'Barcelona (BCN)', '2026-09-27 19:40', 'America/Mexico_City', '2026-09-28 13:50', 'Europe/Madrid',
   'Aeroméxico', 'AM 23', 'QXPL7M', 'https://aeromexico.com', 'Terminal 2 · puerta 72', 'Terminal 1', 38400.00, 'MXN',
   '2 maletas documentadas de 23 kg. Llegar 3 h antes.'),
  ('train', 'Barcelona Sants', 'Madrid Puerta de Atocha', '2026-10-02 10:00', 'Europe/Madrid', '2026-10-02 12:30', 'Europe/Madrid',
   'Renfe', 'AVE 03101', 'RNF8K2Q4', 'https://www.renfe.com', 'Coche 5', 'Vestíbulo principal', 142.60, 'EUR', null),
  ('train', 'Madrid Puerta de Atocha', 'Sevilla Santa Justa', '2026-10-05 09:00', 'Europe/Madrid', '2026-10-05 11:38', 'Europe/Madrid',
   'Renfe', 'AVE 02111', 'RNF3T9W1', 'https://www.renfe.com', 'Coche 3', null, 118.40, 'EUR', null),
  ('bus', 'Sevilla · Estación Plaza de Armas', 'Málaga · Estación de autobuses', '2026-10-08 10:30', 'Europe/Madrid', '2026-10-08 13:15', 'Europe/Madrid',
   'ALSA', '4012', 'ALS-99120', 'https://www.alsa.es', 'Andén 12', null, 49.80, 'EUR', null),
  ('car_rental', 'Málaga · Estación María Zambrano', 'Málaga · Estación María Zambrano', '2026-10-09 09:00', 'Europe/Madrid', '2026-10-10 19:30', 'Europe/Madrid',
   'Europcar', null, 'EC-5518302', 'https://www.europcar.es', 'Mostrador en el vestíbulo', 'Estacionamiento nivel -1', 96.00, 'EUR',
   'Seat Ibiza o similar. Tanque lleno a lleno. Seguro con franquicia 0.'),
  ('flight', 'Málaga (AGP)', 'Madrid (MAD)', '2026-10-11 07:05', 'Europe/Madrid', '2026-10-11 08:20', 'Europe/Madrid',
   'Iberia', 'IB 3999', 'IBR4QZ', 'https://www.iberia.com', 'Terminal 2', 'Terminal 4', null, null, 'Conexión en Madrid: 3 h 45 min.'),
  ('flight', 'Madrid (MAD)', 'Ciudad de México (MEX)', '2026-10-11 12:05', 'Europe/Madrid', '2026-10-11 16:10', 'America/Mexico_City',
   'Iberia', 'IB 6403', 'IBR4QZ', 'https://www.iberia.com', 'Terminal 4S · puerta S28', 'Terminal 1', 31600.00, 'MXN', 'Mismo localizador que el vuelo AGP–MAD.')
) as l(type, origin, destination, departs, dep_tz, arrives, arr_tz, carrier, number, ref, url, dep_detail, arr_detail, cost, currency, notes)
join ids trip on trip.key = 'trip';

-- Seats (both travelers; seats mean one row each)
select public.set_transportation_participants(tr.id, jsonb_build_array(
  jsonb_build_object('traveler_id', (select id from ids where key = 'alberto'), 'seat', s.a),
  jsonb_build_object('traveler_id', (select id from ids where key = 'ximena'), 'seat', s.x)
))
from public.transportations tr
join ids trip on trip.key = 'trip' and tr.trip_id = trip.id
join (values ('AM 23', '24A', '24B'), ('AVE 03101', '7A', '7B'), ('AVE 02111', '11C', '11D'),
             ('4012', '15', '16'), ('IB 3999', '12A', '12B'), ('IB 6403', '31H', '31K')) as s(num, a, x)
  on s.num = tr.service_number;

-- ---------------------------------------------------------------------------
-- Activities (all local Europe/Madrid)
-- ---------------------------------------------------------------------------
insert into public.activities
  (trip_id, trip_stop_id, title, category, starts_at, duration_minutes, timezone, location_name, address,
   booking_status, reservation_ref, cost_amount, cost_currency, external_url, notes)
select trip.id, stop.id, a.title, a.category, a.starts::timestamp at time zone 'Europe/Madrid', a.minutes, 'Europe/Madrid',
  a.place, a.address, a.status, a.ref, a.cost, case when a.cost is null then null else 'EUR' end, a.url, a.notes
from (values
  -- Barcelona
  ('barcelona', 'Traslado aeropuerto → hotel', 'transfer', '2026-09-28 14:15', 45, 'Aerobús + taxi', null, 'planned', null, 12.00, null, null),
  ('barcelona', 'Paseo por el Barrio Gótico', 'sightseeing', '2026-09-28 16:30', 120, 'Barri Gòtic', 'Plaça Nova, Barcelona', 'planned', null, null, null, 'Catedral, Plaça del Rei y El Born.'),
  ('barcelona', 'Tapas en El Xampanyet', 'food', '2026-09-28 20:30', 90, 'El Xampanyet', 'Carrer de Montcada, 22, Barcelona', 'planned', null, null, null, 'No aceptan reservas: llegar temprano.'),
  ('barcelona', 'Sagrada Família con torres', 'sightseeing', '2026-09-29 10:00', 105, 'Basílica de la Sagrada Família', 'Carrer de Mallorca, 401, Barcelona', 'confirmed', 'SF-2931-88', 72.00, 'https://sagradafamilia.org', 'Torre de la Pasión. Entrar 15 min antes.'),
  ('barcelona', 'Mercado de La Boqueria', 'food', '2026-09-29 13:00', 90, 'Mercat de la Boqueria', 'La Rambla, 91, Barcelona', 'planned', null, null, null, null),
  ('barcelona', 'Park Güell', 'sightseeing', '2026-09-29 16:30', 90, 'Park Güell', 'Carrer d''Olot, Barcelona', 'confirmed', 'PG-771204', 36.00, 'https://parkguell.barcelona', null),
  ('barcelona', 'Cena en Cervecería Catalana', 'food', '2026-09-29 21:00', 90, 'Cervecería Catalana', 'Carrer de Mallorca, 236, Barcelona', 'booked', null, null, null, null),
  ('barcelona', 'Casa Batlló', 'sightseeing', '2026-09-30 10:00', 90, 'Casa Batlló', 'Passeig de Gràcia, 43, Barcelona', 'confirmed', 'CB-40921', 70.00, 'https://www.casabatllo.es', null),
  ('barcelona', 'Passeig de Gràcia y La Pedrera', 'sightseeing', '2026-09-30 12:00', 60, 'La Pedrera', 'Passeig de Gràcia, 92, Barcelona', 'planned', null, null, null, 'Solo exterior.'),
  ('barcelona', 'Playa de la Barceloneta', 'free_time', '2026-09-30 17:00', 120, 'Platja de la Barceloneta', null, 'planned', null, null, null, null),
  ('barcelona', 'Paella en Can Solé', 'food', '2026-09-30 20:30', 90, 'Can Solé', 'Carrer de Sant Carles, 4, Barcelona', 'booked', null, null, null, null),
  ('barcelona', 'Excursión a Montserrat', 'tour', '2026-10-01 08:30', 450, 'Punto de encuentro Plaça de Catalunya', 'Plaça de Catalunya, Barcelona', 'confirmed', 'GYG-5521904', 130.00, 'https://www.getyourguide.com', 'Incluye cremallera y cata de licores.'),
  ('barcelona', 'Font Màgica de Montjuïc', 'nightlife', '2026-10-01 21:00', 60, 'Font Màgica', 'Plaça de Carles Buïgas, 1, Barcelona', 'planned', null, null, null, null),
  -- Madrid
  ('madrid', 'Traslado Atocha → hotel', 'transfer', '2026-10-02 12:45', 30, 'Taxi', null, 'planned', null, 15.00, null, null),
  ('madrid', 'Museo del Prado', 'sightseeing', '2026-10-02 15:30', 150, 'Museo Nacional del Prado', 'Calle de Ruiz de Alarcón, 23, Madrid', 'confirmed', 'MP-883120', 30.00, 'https://www.museodelprado.es', 'Velázquez, Goya y El Bosco.'),
  ('madrid', 'Retiro y Palacio de Cristal', 'sightseeing', '2026-10-02 18:30', 90, 'Parque del Retiro', 'Plaza de la Independencia, 7, Madrid', 'planned', null, null, null, null),
  ('madrid', 'Tapas en el Mercado de San Miguel', 'food', '2026-10-02 21:00', 90, 'Mercado de San Miguel', 'Plaza de San Miguel, Madrid', 'planned', null, null, null, null),
  ('madrid', 'Palacio Real', 'sightseeing', '2026-10-03 10:00', 90, 'Palacio Real de Madrid', 'Calle de Bailén, s/n, Madrid', 'confirmed', 'PN-120993', 28.00, 'https://www.patrimonionacional.es', null),
  ('madrid', 'Catedral de la Almudena', 'sightseeing', '2026-10-03 12:00', 45, 'Catedral de la Almudena', 'Calle de Bailén, 10, Madrid', 'planned', null, null, null, null),
  ('madrid', 'Comida en Sobrino de Botín', 'food', '2026-10-03 14:00', 120, 'Restaurante Botín', 'Calle de Cuchilleros, 17, Madrid', 'confirmed', 'BOT-1403', null, 'https://botin.es', 'Cochinillo asado. El restaurante más antiguo del mundo.'),
  ('madrid', 'Museo Reina Sofía (Guernica)', 'sightseeing', '2026-10-03 17:30', 120, 'Museo Reina Sofía', 'Calle de Santa Isabel, 52, Madrid', 'planned', null, null, null, 'Entrada gratis de 19:00 a 21:00.'),
  ('madrid', 'Excursión a Toledo', 'tour', '2026-10-04 09:00', 480, 'Salida desde Plaza de Oriente', 'Plaza de Oriente, Madrid', 'confirmed', 'CVT-338120', 110.00, 'https://www.civitatis.com', 'Catedral, Sinagoga del Tránsito y mirador del Valle.'),
  ('madrid', 'Chocolate con churros en San Ginés', 'food', '2026-10-04 21:30', 45, 'Chocolatería San Ginés', 'Pasadizo de San Ginés, 5, Madrid', 'planned', null, null, null, null),
  -- Sevilla
  ('sevilla', 'Tapas en Bodega Santa Cruz', 'food', '2026-10-05 13:00', 90, 'Bodega Santa Cruz', 'Calle Rodrigo Caro, 1, Sevilla', 'planned', null, null, null, null),
  ('sevilla', 'Real Alcázar', 'sightseeing', '2026-10-05 16:00', 120, 'Real Alcázar de Sevilla', 'Patio de Banderas, s/n, Sevilla', 'confirmed', 'RAS-701224', 31.00, 'https://www.alcazarsevilla.org', null),
  ('sevilla', 'Paseo por el Barrio de Santa Cruz', 'sightseeing', '2026-10-05 19:00', 90, 'Barrio de Santa Cruz', null, 'planned', null, null, null, null),
  ('sevilla', 'Cena en El Rinconcillo', 'food', '2026-10-05 21:30', 90, 'El Rinconcillo', 'Calle Gerona, 40, Sevilla', 'planned', null, null, null, 'Desde 1670.'),
  ('sevilla', 'Catedral y La Giralda', 'sightseeing', '2026-10-06 10:00', 120, 'Catedral de Sevilla', 'Avenida de la Constitución, s/n, Sevilla', 'confirmed', 'CS-44102', 26.00, 'https://www.catedraldesevilla.es', null),
  ('sevilla', 'Plaza de España y Parque de María Luisa', 'sightseeing', '2026-10-06 17:30', 120, 'Plaza de España', 'Avenida de Isabel la Católica, Sevilla', 'planned', null, null, null, null),
  ('sevilla', 'Flamenco en Casa de la Memoria', 'nightlife', '2026-10-06 21:00', 60, 'Casa de la Memoria', 'Calle Cuna, 6, Sevilla', 'confirmed', 'CM-2110', 50.00, 'https://www.casadelamemoria.es', 'Llegar 20 min antes; los lugares no están numerados.'),
  ('sevilla', 'Metropol Parasol (Las Setas)', 'sightseeing', '2026-10-07 10:30', 60, 'Setas de Sevilla', 'Plaza de la Encarnación, s/n, Sevilla', 'planned', null, 30.00, null, null),
  ('sevilla', 'Paseo en barco por el Guadalquivir', 'tour', '2026-10-07 12:30', 60, 'Embarcadero Torre del Oro', 'Paseo de Cristóbal Colón, Sevilla', 'booked', null, 36.00, null, null),
  ('sevilla', 'Cena de tapas en Triana', 'food', '2026-10-07 20:30', 120, 'Calle Betis', 'Calle Betis, Sevilla', 'planned', null, null, null, null),
  -- Málaga
  ('málaga', 'Alcazaba y Teatro Romano', 'sightseeing', '2026-10-08 16:00', 90, 'Alcazaba de Málaga', 'Calle Alcazabilla, 2, Málaga', 'confirmed', 'ALC-8812', 20.00, null, null),
  ('málaga', 'Castillo de Gibralfaro', 'sightseeing', '2026-10-08 18:00', 60, 'Castillo de Gibralfaro', 'Camino Gibralfaro, 11, Málaga', 'planned', null, null, null, 'Atardecer desde la muralla.'),
  ('málaga', 'Cena en El Pimpi', 'food', '2026-10-08 21:00', 90, 'El Pimpi', 'Calle Granada, 62, Málaga', 'booked', null, null, null, null),
  ('málaga', 'Ronda: Puente Nuevo y Plaza de Toros', 'sightseeing', '2026-10-09 10:45', 300, 'Puente Nuevo', 'Calle Armiñán, Ronda', 'planned', null, null, null, '1 h 40 min en auto desde Málaga.'),
  ('málaga', 'Cuevas de Nerja', 'sightseeing', '2026-10-10 10:00', 90, 'Cueva de Nerja', 'Carretera de Maro, s/n, Nerja', 'confirmed', 'CN-55012', 30.00, 'https://www.cuevadenerja.es', null),
  ('málaga', 'Balcón de Europa y playa Burriana', 'free_time', '2026-10-10 12:30', 180, 'Balcón de Europa', 'Plaza Balcón de Europa, Nerja', 'planned', null, null, null, null),
  ('málaga', 'Cena de despedida en El Mesón de Cervantes', 'food', '2026-10-10 21:00', 120, 'El Mesón de Cervantes', 'Calle Álamos, 11, Málaga', 'booked', null, null, null, null),
  ('málaga', 'Traslado al aeropuerto', 'transfer', '2026-10-11 05:15', 30, 'Taxi', null, 'booked', null, 25.00, null, 'Taxi reservado en la recepción del hotel.')
) as a(stop_key, title, category, starts, minutes, place, address, status, ref, cost, url, notes)
join ids stop on stop.key = a.stop_key
join ids trip on trip.key = 'trip';

-- Two afternoons where each goes their own way
insert into public.activities (trip_id, trip_stop_id, title, category, starts_at, duration_minutes, timezone, location_name, address, booking_status, reservation_ref, cost_amount, cost_currency)
select trip.id, stop.id, x.title, x.category, x.starts::timestamp at time zone 'Europe/Madrid', x.minutes, 'Europe/Madrid', x.place, x.address, x.status, x.ref, x.cost, case when x.cost is null then null else 'EUR' end
from (values
  ('Baños árabes Aire de Sevilla', 'free_time', '2026-10-07 16:30', 90, 'Aire Ancient Baths', 'Calle Aire, 15, Sevilla', 'confirmed', 'AIRE-3304', 62.00),
  ('Mercado de Triana y cerámica', 'shopping', '2026-10-07 16:30', 120, 'Mercado de Triana', 'Calle San Jorge, 6, Sevilla', 'planned', null, null)
) as x(title, category, starts, minutes, place, address, status, ref, cost)
join ids stop on stop.key = 'sevilla'
join ids trip on trip.key = 'trip';

select public.set_activity_participants(a.id, array[(select id from ids where key = case when a.title like 'Baños%' then 'ximena' else 'alberto' end)])
from public.activities a join ids trip on trip.key = 'trip' and a.trip_id = trip.id
where a.title in ('Baños árabes Aire de Sevilla', 'Mercado de Triana y cerámica');

-- ---------------------------------------------------------------------------
-- Filling the days: meals, viewpoints and the transfers between activities
-- ---------------------------------------------------------------------------
insert into public.activities
  (trip_id, trip_stop_id, title, category, starts_at, duration_minutes, timezone, location_name, address,
   booking_status, reservation_ref, cost_amount, cost_currency, notes)
select trip.id, s.id, a.title, a.category,
  a.starts::timestamp at time zone 'Europe/Madrid', a.minutes, 'Europe/Madrid', a.place, a.address,
  a.status, a.ref, a.cost, case when a.cost is null then null else 'EUR' end, a.notes
from (values
  -- ── Barcelona · lun 28 sep ──────────────────────────────────────────────
  ('Barcelona', 'Caminar al Barrio Gótico', 'transfer', '2026-09-28 16:00', 25, 'A pie por Via Laietana', null, 'planned', null, null, null),
  ('Barcelona', 'El Born y Santa Maria del Mar', 'sightseeing', '2026-09-28 18:45', 60, 'Basílica de Santa Maria del Mar', 'Plaça de Santa Maria, 1, Barcelona', 'planned', null, null, null),
  ('Barcelona', 'Vermut en Bar del Pla', 'food', '2026-09-28 19:50', 35, 'Bar del Pla', 'Carrer de Montcada, 2, Barcelona', 'planned', null, null, null),
  ('Barcelona', 'Taxi de regreso al hotel', 'transfer', '2026-09-28 22:15', 20, 'Taxi', null, 'planned', null, 12.00, null),
  -- ── Barcelona · mar 29 sep ──────────────────────────────────────────────
  ('Barcelona', 'Desayuno en Brunch & Cake', 'food', '2026-09-29 08:30', 50, 'Brunch & Cake', 'Carrer d''Enric Granados, 19, Barcelona', 'planned', null, null, null),
  ('Barcelona', 'Metro L2 a Sagrada Família', 'transfer', '2026-09-29 09:30', 20, 'Metro L2 · Universitat → Sagrada Família', null, 'planned', null, 5.00, 'T-casual: 10 viajes.'),
  ('Barcelona', 'Fotos desde la Plaça de Gaudí', 'sightseeing', '2026-09-29 11:50', 30, 'Plaça de Gaudí', null, 'planned', null, null, 'La mejor foto de la fachada, reflejada en el lago.'),
  ('Barcelona', 'Metro L5 + L3 a Liceu', 'transfer', '2026-09-29 12:30', 25, 'Metro · Sagrada Família → Liceu', null, 'planned', null, null, null),
  ('Barcelona', 'La Rambla y Palau Güell', 'sightseeing', '2026-09-29 14:35', 60, 'Palau Güell', 'Carrer Nou de la Rambla, 3-5, Barcelona', 'planned', null, null, 'Solo exterior y patio.'),
  ('Barcelona', 'Bus V17 a Park Güell', 'transfer', '2026-09-29 15:50', 35, 'Bus V17 · Plaça de Catalunya → Park Güell', null, 'planned', null, null, null),
  ('Barcelona', 'Mirador Bunkers del Carmel', 'sightseeing', '2026-09-29 18:15', 60, 'Bunkers del Carmel', 'Carrer de Marià Labèrnia, Barcelona', 'planned', null, null, 'Vista de 360° de la ciudad. Llevar agua.'),
  ('Barcelona', 'Taxi al hotel', 'transfer', '2026-09-29 19:25', 25, 'Taxi', null, 'planned', null, 14.00, null),
  ('Barcelona', 'Caminar a Cervecería Catalana', 'transfer', '2026-09-29 20:40', 15, 'A pie por Rambla de Catalunya', null, 'planned', null, null, null),
  -- ── Barcelona · mié 30 sep ──────────────────────────────────────────────
  ('Barcelona', 'Desayuno en Café Cosmo', 'food', '2026-09-30 09:00', 40, 'Café Cosmo', 'Carrer d''Enric Granados, 3, Barcelona', 'planned', null, null, null),
  ('Barcelona', 'Caminar a Casa Batlló', 'transfer', '2026-09-30 09:40', 15, 'A pie', null, 'planned', null, null, null),
  ('Barcelona', 'Comida en Bar Mut', 'food', '2026-09-30 13:15', 90, 'Bar Mut', 'Carrer de Pau Claris, 192, Barcelona', 'booked', null, null, null),
  ('Barcelona', 'Metro L4 a Jaume I', 'transfer', '2026-09-30 14:45', 15, 'Metro L4 · Girona → Jaume I', null, 'planned', null, null, null),
  ('Barcelona', 'Museo Picasso', 'sightseeing', '2026-09-30 15:05', 85, 'Museu Picasso', 'Carrer de Montcada, 15-23, Barcelona', 'confirmed', 'MPB-11209', 30.00, null),
  ('Barcelona', 'Caminar a la Barceloneta', 'transfer', '2026-09-30 16:35', 20, 'A pie por el Passeig Joan de Borbó', null, 'planned', null, null, null),
  ('Barcelona', 'Atardecer en el Port Vell', 'free_time', '2026-09-30 19:05', 60, 'Port Vell', null, 'planned', null, null, null),
  ('Barcelona', 'Caminar a Can Solé', 'transfer', '2026-09-30 20:10', 15, 'A pie', null, 'planned', null, null, null),
  ('Barcelona', 'Taxi al hotel', 'transfer', '2026-09-30 22:10', 25, 'Taxi', null, 'planned', null, 15.00, null),
  -- ── Barcelona · jue 1 oct ───────────────────────────────────────────────
  ('Barcelona', 'Desayuno rápido en el hotel', 'food', '2026-10-01 07:30', 30, 'Casa Bonay', null, 'planned', null, null, 'Incluido en la reserva.'),
  ('Barcelona', 'Caminar a Plaça de Catalunya', 'transfer', '2026-10-01 08:05', 20, 'A pie', null, 'planned', null, null, 'Punto de encuentro frente al Hard Rock Café.'),
  ('Barcelona', 'Descanso en el hotel', 'free_time', '2026-10-01 16:30', 90, 'Casa Bonay', null, 'planned', null, null, null),
  ('Barcelona', 'Metro L3 a Paral·lel', 'transfer', '2026-10-01 18:20', 20, 'Metro L3 · Passeig de Gràcia → Paral·lel', null, 'planned', null, null, null),
  ('Barcelona', 'Cena en Quimet & Quimet', 'food', '2026-10-01 18:45', 90, 'Quimet & Quimet', 'Carrer del Poeta Cabanyes, 25, Barcelona', 'planned', null, null, 'Montaditos de pie. Cierra temprano.'),
  ('Barcelona', 'Caminar a la Font Màgica', 'transfer', '2026-10-01 20:30', 25, 'A pie por Avinguda de la Reina Maria Cristina', null, 'planned', null, null, null),
  ('Barcelona', 'Taxi al hotel', 'transfer', '2026-10-01 22:10', 20, 'Taxi', null, 'planned', null, 12.00, 'Mañana check-out a las 09:00.'),
  -- ── Barcelona → Madrid · vie 2 oct ─────────────────────────────────────
  ('Barcelona', 'Taxi a Barcelona Sants', 'transfer', '2026-10-02 09:15', 25, 'Taxi', null, 'planned', null, 16.00, 'Llegar 30 min antes: hay control de equipaje.'),
  ('Madrid', 'Comida en Casa Labra', 'food', '2026-10-02 13:30', 75, 'Casa Labra', 'Calle de Tetuán, 12, Madrid', 'planned', null, null, 'Croquetas y soldaditos de Pavía.'),
  ('Madrid', 'Caminar al Prado', 'transfer', '2026-10-02 15:05', 20, 'A pie por el Paseo del Prado', null, 'planned', null, null, null),
  ('Madrid', 'Caminar al Retiro', 'transfer', '2026-10-02 18:05', 20, 'A pie', null, 'planned', null, null, null),
  ('Madrid', 'Metro L2 · Retiro → Sol', 'transfer', '2026-10-02 20:10', 25, 'Metro L2', null, 'planned', null, null, null),
  -- ── Madrid · sáb 3 oct ──────────────────────────────────────────────────
  ('Madrid', 'Desayuno en La Mallorquina', 'food', '2026-10-03 09:00', 35, 'La Mallorquina', 'Puerta del Sol, 8, Madrid', 'planned', null, null, 'Napolitanas de crema.'),
  ('Madrid', 'Caminar al Palacio Real', 'transfer', '2026-10-03 09:40', 15, 'A pie por Calle Arenal', null, 'planned', null, null, null),
  ('Madrid', 'Plaza Mayor y Calle Mayor', 'sightseeing', '2026-10-03 12:55', 60, 'Plaza Mayor', 'Plaza Mayor, Madrid', 'planned', null, null, null),
  ('Madrid', 'Paseo por La Latina', 'sightseeing', '2026-10-03 16:05', 55, 'La Latina', null, 'planned', null, null, null),
  ('Madrid', 'Metro L3 a Lavapiés', 'transfer', '2026-10-03 17:05', 20, 'Metro L3 · Sol → Lavapiés', null, 'planned', null, null, null),
  ('Madrid', 'Metro L3 + L10 a Plaza de España', 'transfer', '2026-10-03 19:35', 25, 'Metro · Lavapiés → Plaza de España', null, 'planned', null, null, null),
  ('Madrid', 'Atardecer en el Templo de Debod', 'sightseeing', '2026-10-03 20:05', 55, 'Templo de Debod', 'Calle de Ferraz, 1, Madrid', 'planned', null, null, null),
  ('Madrid', 'Taxi a La Latina', 'transfer', '2026-10-03 21:05', 20, 'Taxi', null, 'planned', null, 10.00, null),
  ('Madrid', 'Cena en Casa Lucio', 'food', '2026-10-03 21:30', 90, 'Casa Lucio', 'Calle Cava Baja, 35, Madrid', 'confirmed', 'CL-2130', null, 'Huevos rotos. Reserva a nombre de Alberto.'),
  -- ── Madrid · dom 4 oct ──────────────────────────────────────────────────
  ('Madrid', 'Desayuno en el hotel', 'food', '2026-10-04 08:00', 40, 'Only YOU Boutique Hotel', null, 'planned', null, null, null),
  ('Madrid', 'Caminar a Plaza de Oriente', 'transfer', '2026-10-04 08:40', 15, 'A pie', null, 'planned', null, null, null),
  ('Madrid', 'Compras en Gran Vía', 'shopping', '2026-10-04 17:30', 120, 'Gran Vía', null, 'planned', null, null, null),
  ('Madrid', 'Tapas en la Cava Baja', 'food', '2026-10-04 19:45', 90, 'Calle Cava Baja', null, 'planned', null, null, null),
  ('Madrid', 'Caminar a San Ginés', 'transfer', '2026-10-04 21:15', 15, 'A pie', null, 'planned', null, null, null),
  ('Madrid', 'Caminar al hotel', 'transfer', '2026-10-04 22:20', 20, 'A pie', null, 'planned', null, null, 'Mañana check-out a las 08:00.'),
  -- ── Madrid → Sevilla · lun 5 oct ───────────────────────────────────────
  ('Madrid', 'Taxi a Atocha', 'transfer', '2026-10-05 08:10', 25, 'Taxi', null, 'planned', null, 12.00, null),
  ('Sevilla', 'Taxi Santa Justa → hotel', 'transfer', '2026-10-05 11:45', 20, 'Taxi', null, 'planned', null, 11.00, 'El hotel guarda maletas antes del check-in.'),
  ('Sevilla', 'Helado en La Fiorentina', 'food', '2026-10-05 18:10', 30, 'Heladería La Fiorentina', 'Calle Zaragoza, 16, Sevilla', 'planned', null, null, null),
  ('Sevilla', 'Caminar a El Rinconcillo', 'transfer', '2026-10-05 21:05', 20, 'A pie', null, 'planned', null, null, null),
  -- ── Sevilla · mar 6 oct ─────────────────────────────────────────────────
  ('Sevilla', 'Tostadas en Bar Alfalfa', 'food', '2026-10-06 09:00', 45, 'Bar Alfalfa', 'Calle Candilejo, 1, Sevilla', 'planned', null, null, null),
  ('Sevilla', 'Archivo de Indias', 'sightseeing', '2026-10-06 12:10', 50, 'Archivo General de Indias', 'Avenida de la Constitución, s/n, Sevilla', 'planned', null, null, 'Entrada gratuita.'),
  ('Sevilla', 'Comida en Eslava', 'food', '2026-10-06 13:30', 90, 'Eslava', 'Calle Eslava, 3, Sevilla', 'confirmed', 'ESL-1330', null, 'Huevo sobre bizcocho de boletus.'),
  ('Sevilla', 'Siesta', 'free_time', '2026-10-06 15:15', 90, 'Hotel Casa 1800', null, 'planned', null, null, null),
  ('Sevilla', 'Tranvía T1 a Prado de San Sebastián', 'transfer', '2026-10-06 17:00', 20, 'Tranvía T1 · Archivo de Indias → Prado', null, 'planned', null, null, null),
  ('Sevilla', 'Torre del Oro y paseo por el río', 'sightseeing', '2026-10-06 19:40', 45, 'Torre del Oro', 'Paseo de Cristóbal Colón, s/n, Sevilla', 'planned', null, null, null),
  ('Sevilla', 'Caminar a Casa de la Memoria', 'transfer', '2026-10-06 20:30', 20, 'A pie', null, 'planned', null, null, null),
  -- ── Sevilla · mié 7 oct ─────────────────────────────────────────────────
  ('Sevilla', 'Churros en Bar El Comercio', 'food', '2026-10-07 09:30', 40, 'Bar El Comercio', 'Calle Lineros, 9, Sevilla', 'planned', null, null, null),
  ('Sevilla', 'Caminar a Las Setas', 'transfer', '2026-10-07 10:12', 15, 'A pie', null, 'planned', null, null, null),
  ('Sevilla', 'Caminar a la Torre del Oro', 'transfer', '2026-10-07 11:45', 25, 'A pie por la Avenida de la Constitución', null, 'planned', null, null, null),
  ('Sevilla', 'Comida en Bar Las Teresas', 'food', '2026-10-07 13:45', 90, 'Bar Las Teresas', 'Calle Santa Teresa, 2, Sevilla', 'planned', null, null, null),
  ('Sevilla', 'Atardecer en el Puente de Triana', 'sightseeing', '2026-10-07 18:45', 45, 'Puente de Isabel II', null, 'planned', null, null, null),
  -- ── Sevilla → Málaga · jue 8 oct ───────────────────────────────────────
  ('Sevilla', 'Taxi a la estación Plaza de Armas', 'transfer', '2026-10-08 09:45', 20, 'Taxi', null, 'planned', null, 9.00, null),
  ('Málaga', 'Taxi al hotel', 'transfer', '2026-10-08 13:20', 20, 'Taxi', null, 'planned', null, 10.00, null),
  ('Málaga', 'Comida en el Mercado de Atarazanas', 'food', '2026-10-08 13:50', 70, 'Mercado Central de Atarazanas', 'Calle Atarazanas, 10, Málaga', 'planned', null, null, 'Pescaíto frito en el bar del mercado.'),
  ('Málaga', 'Subir a pie a Gibralfaro', 'transfer', '2026-10-08 17:35', 20, 'A pie por el Paseo Don Juan Temboury', null, 'planned', null, null, 'Cuesta arriba: llevar agua.'),
  ('Málaga', 'Calle Larios y Muelle Uno', 'sightseeing', '2026-10-08 19:15', 90, 'Calle Larios', null, 'planned', null, null, null),
  -- ── Málaga · vie 9 oct ──────────────────────────────────────────────────
  ('Málaga', 'Desayuno en Café Central', 'food', '2026-10-09 08:00', 35, 'Café Central', 'Plaza de la Constitución, 11, Málaga', 'planned', null, null, 'Pedir un "mitad": café con leche a partes iguales.'),
  ('Málaga', 'Taxi a la estación María Zambrano', 'transfer', '2026-10-09 08:40', 15, 'Taxi', null, 'planned', null, 9.00, null),
  ('Málaga', 'Manejar a Ronda (A-357)', 'transfer', '2026-10-09 09:10', 90, 'Auto rentado', null, 'planned', null, null, 'Estacionamiento Plaza del Socorro.'),
  ('Málaga', 'Manejar de regreso a Málaga', 'transfer', '2026-10-09 16:00', 95, 'Auto rentado', null, 'planned', null, null, null),
  ('Málaga', 'Playa de la Malagueta', 'free_time', '2026-10-09 18:00', 60, 'Playa de la Malagueta', null, 'planned', null, null, null),
  ('Málaga', 'Cena en Los Mellizos', 'food', '2026-10-09 20:30', 90, 'Los Mellizos', 'Calle Sancha de Lara, 7, Málaga', 'booked', null, null, 'Espetos de sardinas.'),
  -- ── Málaga · sáb 10 oct ─────────────────────────────────────────────────
  ('Málaga', 'Manejar a Nerja (A-7)', 'transfer', '2026-10-10 08:50', 60, 'Auto rentado', null, 'planned', null, null, 'Salir temprano: se llena el estacionamiento de la cueva.'),
  ('Málaga', 'Manejar de regreso a Málaga', 'transfer', '2026-10-10 15:45', 60, 'Auto rentado', null, 'planned', null, null, null),
  ('Málaga', 'Museo Picasso Málaga', 'sightseeing', '2026-10-10 17:00', 90, 'Museo Picasso Málaga', 'Calle San Agustín, 8, Málaga', 'confirmed', 'MPM-7812', 24.00, null),
  ('Málaga', 'Cargar gasolina y devolver el auto', 'transfer', '2026-10-10 18:50', 40, 'Estación María Zambrano', null, 'planned', null, 45.00, 'Devolver con el tanque lleno.'),
  ('Málaga', 'Hacer maletas', 'free_time', '2026-10-10 19:45', 60, 'Molina Lario Hotel', null, 'planned', null, null, null),
  ('Málaga', 'Caminar a El Mesón de Cervantes', 'transfer', '2026-10-10 20:50', 10, 'A pie', null, 'planned', null, null, null)
) as a(city, title, category, starts, minutes, place, address, status, ref, cost, notes)
join ids trip on trip.key = 'trip'
join public.trip_stops s on s.trip_id = trip.id and s.name = a.city;


-- ---------------------------------------------------------------------------
-- Approximate coordinates for the Map page (no Google Places requests needed).
-- Transfers stay without coordinates: they aren't a place.
-- ---------------------------------------------------------------------------
update public.trip_stops s set lat = c.lat, lng = c.lng
from (values
  ('Barcelona', 41.3874, 2.1686), ('Madrid', 40.4168, -3.7038),
  ('Sevilla', 37.3891, -5.9845), ('Málaga', 36.7213, -4.4214)
) as c(name, lat, lng)
where s.trip_id = (select id from ids where key = 'trip') and s.name = c.name;

update public.accommodations a set lat = c.lat, lng = c.lng
from (values
  ('Casa Bonay', 41.3938, 2.1714),
  ('Only YOU Boutique Hotel Madrid', 40.4205, -3.6966),
  ('Hotel Casa 1800 Sevilla', 37.3858, -5.9913),
  ('Molina Lario Hotel', 36.7195, -4.4195)
) as c(name, lat, lng)
where a.trip_id = (select id from ids where key = 'trip') and a.name = c.name;

update public.activities a set lat = c.lat, lng = c.lng
from (values
  -- Barcelona
  ('Paseo por el Barrio Gótico', 41.3845, 2.1757), ('Tapas en El Xampanyet', 41.3848, 2.1810),
  ('El Born y Santa Maria del Mar', 41.3838, 2.1820), ('Vermut en Bar del Pla', 41.3846, 2.1806),
  ('Desayuno en Brunch & Cake', 41.3890, 2.1599), ('Sagrada Família con torres', 41.4036, 2.1744),
  ('Fotos desde la Plaça de Gaudí', 41.4041, 2.1747), ('Mercado de La Boqueria', 41.3818, 2.1716),
  ('La Rambla y Palau Güell', 41.3789, 2.1742), ('Park Güell', 41.4145, 2.1527),
  ('Mirador Bunkers del Carmel', 41.4190, 2.1618), ('Cena en Cervecería Catalana', 41.3927, 2.1609),
  ('Desayuno en Café Cosmo', 41.3867, 2.1614), ('Casa Batlló', 41.3917, 2.1649),
  ('Passeig de Gràcia y La Pedrera', 41.3953, 2.1620), ('Comida en Bar Mut', 41.3961, 2.1636),
  ('Museo Picasso', 41.3852, 2.1809), ('Playa de la Barceloneta', 41.3784, 2.1925),
  ('Atardecer en el Port Vell', 41.3765, 2.1822), ('Paella en Can Solé', 41.3802, 2.1893),
  ('Desayuno rápido en el hotel', 41.3938, 2.1714), ('Excursión a Montserrat', 41.3870, 2.1701),
  ('Descanso en el hotel', 41.3938, 2.1714), ('Cena en Quimet & Quimet', 41.3739, 2.1646),
  ('Font Màgica de Montjuïc', 41.3712, 2.1517),
  -- Madrid
  ('Comida en Casa Labra', 40.4180, -3.7045), ('Museo del Prado', 40.4138, -3.6921),
  ('Retiro y Palacio de Cristal', 40.4135, -3.6827), ('Tapas en el Mercado de San Miguel', 40.4154, -3.7090),
  ('Desayuno en La Mallorquina', 40.4169, -3.7034), ('Palacio Real', 40.4180, -3.7143),
  ('Catedral de la Almudena', 40.4157, -3.7146), ('Plaza Mayor y Calle Mayor', 40.4155, -3.7074),
  ('Comida en Sobrino de Botín', 40.4141, -3.7083), ('Paseo por La Latina', 40.4115, -3.7115),
  ('Museo Reina Sofía (Guernica)', 40.4086, -3.6944), ('Atardecer en el Templo de Debod', 40.4240, -3.7178),
  ('Cena en Casa Lucio', 40.4125, -3.7090), ('Desayuno en el hotel', 40.4205, -3.6966),
  ('Excursión a Toledo', 40.4185, -3.7120), ('Compras en Gran Vía', 40.4203, -3.7058),
  ('Tapas en la Cava Baja', 40.4128, -3.7089), ('Chocolate con churros en San Ginés', 40.4168, -3.7066),
  -- Sevilla
  ('Tapas en Bodega Santa Cruz', 37.3860, -5.9906), ('Real Alcázar', 37.3831, -5.9903),
  ('Helado en La Fiorentina', 37.3884, -5.9978), ('Paseo por el Barrio de Santa Cruz', 37.3857, -5.9885),
  ('Cena en El Rinconcillo', 37.3945, -5.9885), ('Tostadas en Bar Alfalfa', 37.3915, -5.9895),
  ('Catedral y La Giralda', 37.3861, -5.9926), ('Archivo de Indias', 37.3846, -5.9932),
  ('Comida en Eslava', 37.3990, -5.9974), ('Siesta', 37.3858, -5.9913),
  ('Plaza de España y Parque de María Luisa', 37.3772, -5.9869), ('Torre del Oro y paseo por el río', 37.3824, -5.9964),
  ('Flamenco en Casa de la Memoria', 37.3918, -5.9942), ('Churros en Bar El Comercio', 37.3924, -5.9953),
  ('Metropol Parasol (Las Setas)', 37.3933, -5.9917), ('Paseo en barco por el Guadalquivir', 37.3824, -5.9964),
  ('Comida en Bar Las Teresas', 37.3862, -5.9895), ('Baños árabes Aire de Sevilla', 37.3888, -5.9892),
  ('Mercado de Triana y cerámica', 37.3858, -6.0030), ('Atardecer en el Puente de Triana', 37.3857, -6.0013),
  ('Cena de tapas en Triana', 37.3840, -6.0010),
  -- Málaga
  ('Comida en el Mercado de Atarazanas', 36.7183, -4.4240), ('Alcazaba y Teatro Romano', 36.7212, -4.4159),
  ('Castillo de Gibralfaro', 36.7234, -4.4119), ('Calle Larios y Muelle Uno', 36.7196, -4.4216),
  ('Cena en El Pimpi', 36.7219, -4.4172), ('Desayuno en Café Central', 36.7206, -4.4214),
  ('Ronda: Puente Nuevo y Plaza de Toros', 36.7409, -5.1662), ('Playa de la Malagueta', 36.7197, -4.4079),
  ('Cena en Los Mellizos', 36.7179, -4.4195), ('Cuevas de Nerja', 36.7617, -3.8456),
  ('Balcón de Europa y playa Burriana', 36.7456, -3.8757), ('Museo Picasso Málaga', 36.7216, -4.4185),
  ('Hacer maletas', 36.7195, -4.4195), ('Cena de despedida en El Mesón de Cervantes', 36.7222, -4.4196)
) as c(title, lat, lng)
where a.trip_id = (select id from ids where key = 'trip') and a.title = c.title;

-- ---------------------------------------------------------------------------
-- Saved places: recommendations not (all) in the plan yet
-- ---------------------------------------------------------------------------
insert into public.saved_places (trip_id, trip_stop_id, name, category, address, lat, lng, estimated_minutes, external_url, notes)
select trip.id, s.id, p.name, p.category, p.address, p.lat, p.lng, p.minutes, p.url, p.notes
from (values
  ('Barcelona', 'Casa Vicens', 'sightseeing', 'Carrer de les Carolines, 20-26, Barcelona', 41.4035, 2.1506, 75, 'https://casavicens.org', 'La primera casa de Gaudí. Menos gente que Batlló.'),
  ('Barcelona', 'Bar Cañete', 'food', 'Carrer de la Unió, 17, Barcelona', 41.3797, 2.1733, 90, null, 'Recomendación de Ximena. Reservar barra.'),
  ('Barcelona', 'Mercat de Sant Antoni', 'shopping', 'Carrer del Comte d''Urgell, 1, Barcelona', 41.3787, 2.1622, 60, null, 'Domingo por la mañana: mercado de libros.'),
  ('Barcelona', 'Tibidabo', 'sightseeing', 'Plaça del Tibidabo, 3-4, Barcelona', 41.4225, 2.1186, 180, null, 'Vista de toda la ciudad. Funicular desde Plaça del Doctor Andreu.'),
  ('Madrid', 'Casa Lucio', 'food', 'Calle Cava Baja, 35, Madrid', 40.4125, -3.7090, 90, null, 'Huevos rotos.'),
  ('Madrid', 'Museo Thyssen-Bornemisza', 'sightseeing', 'Paseo del Prado, 8, Madrid', 40.4161, -3.6949, 120, 'https://www.museothyssen.org', 'Gratis los lunes de 12 a 16 h.'),
  ('Madrid', 'El Rastro', 'shopping', 'Calle de la Ribera de Curtidores, Madrid', 40.4087, -3.7075, 120, null, 'Solo domingos y festivos, de 9 a 15 h.'),
  ('Sevilla', 'Palacio de las Dueñas', 'sightseeing', 'Calle Dueñas, 5, Sevilla', 37.3951, -5.9905, 60, null, null),
  ('Sevilla', 'Bodeguita Romero', 'food', 'Calle Harinas, 10, Sevilla', 37.3863, -5.9955, 60, null, 'Montadito de pringá.'),
  ('Málaga', 'El Pimpi', 'food', 'Calle Granada, 62, Málaga', 36.7219, -4.4172, 90, null, null),
  ('Málaga', 'Caminito del Rey', 'tour', 'Ardales, Málaga', 36.9313, -4.7859, 240, 'https://www.caminitodelrey.info', 'Hay que reservar con semanas de anticipación. ¿Cabe el día 13?'),
  ('Málaga', 'Frigiliana', 'sightseeing', 'Frigiliana, Málaga', 36.7898, -3.8942, 120, null, 'Pueblo blanco a 10 min de Nerja.')
) as p(city, name, category, address, lat, lng, minutes, url, notes)
join ids trip on trip.key = 'trip'
join public.trip_stops s on s.trip_id = trip.id and s.name = p.city;

-- Two of them are already planned: link the activities back to the saved place.
update public.activities a set saved_place_id = sp.id
from public.saved_places sp
where a.trip_id = (select id from ids where key = 'trip') and sp.trip_id = a.trip_id
  and (a.title, sp.name) in (('Cena en Casa Lucio', 'Casa Lucio'), ('Cena en El Pimpi', 'El Pimpi'));

-- Summary
select
  (select name from public.trips where id = (select id from ids where key = 'trip')) as trip,
  (select id from ids where key = 'trip') as trip_id,
  (select count(*) from public.trip_stops where trip_id = (select id from ids where key = 'trip')) as stops,
  (select count(*) from public.travelers where trip_id = (select id from ids where key = 'trip')) as travelers,
  (select count(*) from public.accommodations where trip_id = (select id from ids where key = 'trip')) as stays,
  (select count(*) from public.transportations where trip_id = (select id from ids where key = 'trip')) as legs,
  (select count(*) from public.activities where trip_id = (select id from ids where key = 'trip')) as activities,
  (select count(*) from public.saved_places where trip_id = (select id from ids where key = 'trip')) as saved;


commit;
