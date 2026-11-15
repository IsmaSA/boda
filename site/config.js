/* ==========================================================================
   CONFIGURACIÓN DE LA WEB DE LA BODA — Isma & Sara
   --------------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitáis tocar para cambiar textos y datos.

   · Cada texto tiene dos versiones: es (español) y en (inglés).
   · Si un valor es  null  o una lista vacía  []  esa información NO se
     muestra en la web. Así nada sin confirmar aparece publicado.
   · Lo marcado con  ⚠️ POR CONFIRMAR  es una decisión vuestra.
   · Después de guardar, haced commit + push: GitHub publica solo en ~1 min.
     Si hay un error de escritura, la publicación se detiene y GitHub os avisa
     (la web anterior sigue funcionando).
   ========================================================================== */

export const config = {
  couple: {
    first: 'Isma',
    second: 'Sara',
  },

  wedding: {
    date: '2027-09-18', // AAAA-MM-DD
    timeZone: 'Europe/Madrid',
    // Hora oficial de la ceremonia y del banquete (formato 'HH:MM').
    // ⚠️ POR CONFIRMAR — mientras sean null no se muestran.
    ceremonyTime: null,
    receptionTime: null,
    // La cuenta atrás apunta a ceremonyTime si existe; si no, a esta hora del día de la boda.
    countdownFallbackTime: '00:00',
  },

  venue: {
    name: 'Restaurante Casablanca',
    // Dirección según Bodas.net y la ficha de Google Maps del restaurante (17/10/2026).
    street: 'Avenida de Chile, s/n',
    landmark: { es: 'Frente al Palacio de Congresos', en: 'Opposite the Palacio de Congresos' },
    postalCode: '06700',
    town: 'Villanueva de la Serena',
    province: 'Badajoz',
    region: 'Extremadura',
    // Botón «Cómo llegar»: abre la ficha del restaurante en Google Maps.
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Restaurante%20Casablanca%20Villanueva%20de%20la%20Serena&query_place_id=ChIJ2aPI-adZFA0RfFYsNuMl5xw',
    // Mapa junto a la dirección (Google Maps). null = sin mapa.
    map: {
      lat: 38.9696307,
      lng: -5.783303,
      zoom: 16,
      // Google Maps solo se carga cuando el invitado pulsa «Mostrar mapa», porque
      // usa cookies de Google (la ley española pide consentimiento). Si preferís
      // que aparezca directamente, poned false y revisad el aviso de privacidad.
      askFirst: true,
      // Opcional: en Google Maps → Compartir → Insertar un mapa, copiad solo la
      // dirección que va dentro de src="…" y pegadla aquí para usar ese mapa.
      embedUrl: null,
    },
  },

  // Dirección pública de la web (para buscadores y vista previa al compartir).
  siteUrl: 'https://isma-sara.github.io/',

  messages: {
    welcome: {
      es: 'Queremos celebrar el día de nuestra boda con las personas que más queremos. Aquí encontraréis todo lo necesario para acompañarnos.',
      en: 'We want to celebrate our wedding day with the people we love most. Here you will find everything you need to join us.',
    },
    story: {
      es: 'Hay días que merecen celebrarse a lo grande, y para nosotros este es uno de ellos. Nos hace muchísima ilusión reunir a nuestra familia y a nuestros amigos en una misma mesa y empezar juntos esta nueva etapa. Nada nos haría más felices que veros allí.',
      en: 'Some days deserve a proper celebration, and for us this is one of them. We are so excited to gather our family and friends around one table and begin this new chapter together. Nothing would make us happier than seeing you there.',
    },
    closing: {
      es: 'Gracias por formar parte de nuestra historia. Os esperamos en Villanueva de la Serena.',
      en: 'Thank you for being part of our story. We look forward to seeing you in Villanueva de la Serena.',
    },
  },

  // Fotos. Para añadir una nueva:
  //   python3 scripts/process_photos.py ruta/foto.jpg nombre
  // (quita la ubicación GPS y crea fotos/nombre-640.webp y -1280.webp) y añadid
  // aquí { src: 'assets/img/fotos/nombre', width, height, alt: { es, en } }.
  // Para quitar una foto, borrad su bloque. hero: null = portada con la ilustración.
  // position (opcional) elige qué parte se ve si la foto se recorta: '50% 70%'.
  photos: {
    hero: null,
    story: {
      src: 'assets/img/fotos/pedida', width: 900, height: 1600, position: '50% 68%',
      alt: {
        es: 'Isma, de rodillas en un mirador sobre una ciudad de tejados rojos, le enseña el anillo a Sara, que se tapa la cara de la emoción',
        en: 'Isma on one knee at a viewpoint over a town of red roofs, showing Sara the ring as she covers her face',
      },
    },
    gallery: [
      {
        src: 'assets/img/fotos/boda-invitados', width: 1200, height: 1600,
        alt: { es: 'Isma y Sara, de traje y vestido teja, en la escalinata de piedra de una iglesia', en: 'Isma and Sara, in a suit and a rust-coloured dress, on the stone steps of a church' },
      },
      {
        src: 'assets/img/fotos/sofa-gato', width: 1280, height: 960,
        alt: { es: 'Isma y Sara en el sofá bajo una manta, con su gato naranja dormido encima', en: 'Isma and Sara on the sofa under a blanket, with their ginger cat asleep on top' },
      },
      {
        src: 'assets/img/fotos/cumple-30', width: 1280, height: 1707,
        alt: { es: 'Isma abraza a Sara, que sostiene al gato naranja, delante de una tarta con velas del número 30', en: 'Isma hugging Sara, who is holding the ginger cat, behind a cake with number 30 candles' },
      },
      {
        src: 'assets/img/fotos/tren', width: 1080, height: 1440,
        alt: { es: 'Isma pone cara de resignación mientras Sara duerme junto a la ventanilla del tren', en: 'Isma looking resigned while Sara sleeps by the train window' },
      },
      {
        src: 'assets/img/fotos/gato-espalda', width: 1200, height: 1599,
        alt: { es: 'Sara, tumbada, sonríe junto a Isma mientras el gato naranja descansa sobre su espalda', en: 'Sara, lying down, smiles next to Isma while the ginger cat rests on her back' },
      },
      {
        src: 'assets/img/fotos/siesta', width: 1280, height: 1707,
        alt: { es: 'Sara dormida en el sofá mientras Isma, con la camiseta del Betis, pone cara de sorpresa', en: 'Sara asleep on the sofa while Isma, in a Real Betis shirt, makes a surprised face' },
      },
    ],
  },

  rsvp: {
    // URL de la aplicación web de Google Apps Script (termina en /exec).
    // Vacío = el formulario se muestra pero avisa de que aún no está activo.
    endpoint: 'https://script.google.com/macros/s/AKfycbw_JMEHg0iGoEAoE5DHiqRE9rkFzUxQDnzNvF26_9Qrrv9G4XBSoaIM9Pqw2UY__6xaJQ/exec',
    // Fecha límite para confirmar, 'AAAA-MM-DD' (incluida). ⚠️ POR CONFIRMAR
    // Debe coincidir con la propiedad RSVP_DEADLINE del script.
    deadline: null,
    // Máximo de personas por respuesta, incluido quien responde (pareja y demás
    // acompañantes se añaden uno a uno). ⚠️ POR CONFIRMAR
    // Debe coincidir con MAX_PARTY del script (por defecto 50).
    maxPartySize: 50,
    allowCompanions: true, // ⚠️ POR CONFIRMAR (ALLOW_COMPANIONS)
    allowChildren: false, // ⚠️ POR CONFIRMAR (ALLOW_CHILDREN)
    allowUpdates: true, // permite modificar la respuesta con un enlace privado (ALLOW_UPDATES)
    askDietary: true,
    askAccessibility: true,
    // GIF que aparece al pulsar «Enviar respuesta» (cuando el formulario está bien
    // rellenado) y se queda junto al «¡Gracias!». Se carga desde GIPHY solo en ese
    // momento. null = sin GIF.
    celebration: {
      gif: 'https://media.giphy.com/media/B1CrvUCoMxhy8/giphy.gif',
      // fotograma fijo para quien tiene activado «reducir movimiento»
      still: 'https://media.giphy.com/media/B1CrvUCoMxhy8/giphy_s.gif',
      source: 'https://giphy.com/gifs/disneypixar-disney-pixar-B1CrvUCoMxhy8',
      credit: 'Disney Pixar',
      alt: { es: 'Rayo McQueen celebrándolo', en: 'Lightning McQueen celebrating' },
    },
  },

  // Información práctica. null = oculto.
  details: {
    dressCode: null, // { es: '…', en: '…' }
    parking: null,
    transport: null,
    notes: [], // [{ es: '…', en: '…' }]
  },

  // Programa del día. Mientras esté vacío se muestra «Próximamente…».
  schedule: [
    // { time: '12:30', title: { es: 'Ceremonia', en: 'Ceremony' }, description: { es: '…', en: '…' } },
  ],

  travel: {
    intro: {
      es: 'Villanueva de la Serena está en las Vegas Altas del Guadiana, junto a Don Benito, en la provincia de Badajoz.',
      en: 'Villanueva de la Serena lies in the Vegas Altas of the Guadiana, next to Don Benito, in the province of Badajoz.',
    },
    accommodation: [
      // { name: 'Hotel …', note: { es: '…', en: '…' }, url: 'https://…' },
    ],
    // Rutas desde otras ciudades (pestañas en «Cómo llegar»).
    // Datos consultados en octubre de 2026 (Renfe/Omio, directflights.com,
    // Junta de Extremadura); los horarios de 2027 pueden cambiar.
    // mode: 'car' | 'train' | 'bus' | 'plane'.
    // directions (opcional): añade «Ver ruta en Google Maps» desde ese punto.
    routesNote: {
      es: 'Tiempos y frecuencias orientativos (octubre de 2026). Comprobad los horarios de 2027 en renfe.com o en la web de la aerolínea antes de reservar.',
      en: 'Times and frequencies are approximate (October 2026). Check the 2027 timetables on renfe.com or the airline’s website before booking.',
    },
    routes: [
      {
        from: { es: 'Mérida', en: 'Mérida' },
        options: [
          { mode: 'car', time: { es: 'Unos 45 min', en: 'About 45 min' },
            text: { es: 'La forma más cómoda.', en: 'The easiest option.' },
            directions: { from: 'Mérida, Badajoz' } },
          { mode: 'train', time: { es: 'Unos 45 min', en: 'About 45 min' },
            text: { es: 'Tren regional de Renfe hasta la estación de Villanueva de la Serena, 3 o 4 al día.', en: 'Renfe regional train to Villanueva de la Serena station, 3 or 4 a day.' } },
        ],
      },
      {
        from: { es: 'Sevilla', en: 'Seville' },
        options: [
          { mode: 'car', time: { es: 'Unas 2 h 40 min', en: 'About 2 h 40 min' },
            text: { es: 'Unos 250 km, por la A-66 hasta Mérida.', en: 'About 250 km, on the A-66 to Mérida.' },
            directions: { from: 'Sevilla' } },
          { mode: 'train', time: { es: 'Unas 4 h 20 min', en: 'About 4 h 20 min' },
            text: { es: 'Renfe, con un transbordo. En coche se tarda bastante menos.', en: 'Renfe, with one change. Driving is much quicker.' } },
        ],
      },
      {
        from: { es: 'Madrid', en: 'Madrid' },
        options: [
          { mode: 'car', time: { es: 'Algo más de 3 h', en: 'Just over 3 h' },
            text: { es: 'Por la A-5 (Autovía del Suroeste).', en: 'On the A-5 motorway (Autovía del Suroeste).' },
            directions: { from: 'Madrid' } },
          { mode: 'train', time: { es: 'Unas 4 h', en: 'About 4 h' },
            text: { es: 'Desde Madrid Atocha con Renfe, normalmente con un transbordo.', en: 'From Madrid Atocha with Renfe, usually with one change.' } },
          { mode: 'bus', time: { es: 'De 4 h 30 min a 5 h', en: '4 h 30 min to 5 h' },
            text: { es: 'Desde la Estación Sur (Méndez Álvaro) con Samar o Avanza, unos 4 al día.', en: 'From Estación Sur (Méndez Álvaro) with Samar or Avanza, about 4 a day.' } },
        ],
      },
      {
        from: { es: 'Barcelona', en: 'Barcelona' },
        options: [
          { mode: 'plane', time: { es: '1 h 40 min de vuelo', en: '1 h 40 min flight' },
            text: { es: 'Vuelo directo a Badajoz (Iberia, unos 5 a la semana) y después algo más de 1 h en coche.', en: 'Direct flight to Badajoz (Iberia, about 5 a week), then just over 1 h by car.' },
            directions: { from: 'Aeropuerto de Badajoz' } },
          { mode: 'plane', time: { es: '1 h 45 min de vuelo', en: '1 h 45 min flight' },
            text: { es: 'Vuelo a Sevilla (Vueling y Ryanair, varios al día) y unas 2 h 40 min en coche.', en: 'Flight to Seville (Vueling and Ryanair, several a day), then about 2 h 40 min by car.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
          { mode: 'train', time: { es: 'Unas 2 h 30 min hasta Madrid', en: 'About 2 h 30 min to Madrid' },
            text: { es: 'AVE a Madrid y desde allí tren, autobús o coche (ver «Madrid»).', en: 'High-speed train to Madrid, then train, bus or car (see “Madrid”).' } },
        ],
      },
      {
        from: { es: 'Bilbao', en: 'Bilbao' },
        options: [
          { mode: 'car', time: { es: 'Unas 6 h 30 min', en: 'About 6 h 30 min' },
            text: { es: 'Unos 650 km, por Burgos, Salamanca y la A-66 (Ruta de la Plata). Conviene parar a mitad de camino.', en: 'About 650 km, via Burgos, Salamanca and the A-66 (Ruta de la Plata). Worth a stop halfway.' },
            directions: { from: 'Bilbao' } },
          { mode: 'plane', time: { es: 'Alrededor de 1 h 30 min de vuelo', en: 'About 1 h 30 min flight' },
            text: { es: 'Vuelo directo a Sevilla con Vueling y unas 2 h 40 min en coche. No hay vuelo directo a Badajoz.', en: 'Direct flight to Seville with Vueling, then about 2 h 40 min by car. There is no direct flight to Badajoz.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
          { mode: 'train', time: { es: 'Unas 5 h hasta Madrid', en: 'About 5 h to Madrid' },
            text: { es: 'Tren a Madrid con Renfe y desde allí tren, autobús o coche (ver «Madrid»).', en: 'Renfe train to Madrid, then train, bus or car (see “Madrid”).' } },
        ],
      },
      {
        from: { es: 'Almería', en: 'Almería' },
        options: [
          { mode: 'car', time: { es: 'Unas 5 h 30 min', en: 'About 5 h 30 min' },
            text: { es: 'Unos 550 km, por Granada y Córdoba. Conviene parar a mitad de camino.', en: 'About 550 km, via Granada and Córdoba. Worth a stop halfway.' },
            directions: { from: 'Almería' } },
          { mode: 'plane', time: { es: 'Alrededor de 1 h 10 min de vuelo', en: 'About 1 h 10 min flight' },
            text: { es: 'Vuelo directo a Madrid con Iberia y después coche, tren o autobús (ver «Madrid»).', en: 'Direct flight to Madrid with Iberia, then car, train or bus (see “Madrid”).' },
            directions: { from: 'Aeropuerto Adolfo Suárez Madrid-Barajas' } },
        ],
      },
      {
        from: { es: 'Suiza', en: 'Switzerland' },
        options: [
          { mode: 'plane', time: { es: 'Unas 2 h 15 min de vuelo', en: 'About 2 h 15 min flight' },
            text: { es: 'Vuelos directos a Madrid desde Zúrich, Ginebra y Basilea (Iberia, Swiss y easyJet, varios al día) y después coche, tren o autobús (ver «Madrid»).', en: 'Direct flights to Madrid from Zurich, Geneva and Basel (Iberia, Swiss and easyJet, several a day), then car, train or bus (see “Madrid”).' },
            directions: { from: 'Aeropuerto Adolfo Suárez Madrid-Barajas' } },
          { mode: 'plane', time: { es: 'Unas 2 h 30 min de vuelo', en: 'About 2 h 30 min flight' },
            text: { es: 'Vuelo directo de Ginebra a Sevilla con easyJet y unas 2 h 40 min en coche.', en: 'Direct flight from Geneva to Seville with easyJet, then about 2 h 40 min by car.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
        ],
      },
      {
        from: { es: 'Praga', en: 'Prague' },
        options: [
          { mode: 'plane', time: { es: 'Unas 3 h de vuelo', en: 'About 3 h flight' },
            text: { es: 'Vuelo directo a Madrid (Iberia, Smartwings y Ryanair, varios al día) y después coche, tren o autobús (ver «Madrid»).', en: 'Direct flight to Madrid (Iberia, Smartwings and Ryanair, several a day), then car, train or bus (see “Madrid”).' },
            directions: { from: 'Aeropuerto Adolfo Suárez Madrid-Barajas' } },
          { mode: 'plane', time: { es: 'Unas 3 h 20 min de vuelo', en: 'About 3 h 20 min flight' },
            text: { es: 'Vuelo directo a Sevilla con Ryanair (unos 2 a la semana en temporada) y unas 2 h 40 min en coche.', en: 'Direct flight to Seville with Ryanair (about 2 a week in season), then about 2 h 40 min by car.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
        ],
      },
      {
        from: { es: 'Fráncfort', en: 'Frankfurt' },
        options: [
          { mode: 'plane', time: { es: 'Unas 2 h 40 min de vuelo', en: 'About 2 h 40 min flight' },
            text: { es: 'Vuelo directo a Madrid (Lufthansa, Iberia y Air Europa, varios al día) y después coche, tren o autobús (ver «Madrid»).', en: 'Direct flight to Madrid (Lufthansa, Iberia and Air Europa, several a day), then car, train or bus (see “Madrid”).' },
            directions: { from: 'Aeropuerto Adolfo Suárez Madrid-Barajas' } },
          { mode: 'plane', time: { es: 'Unas 2 h 55 min de vuelo', en: 'About 2 h 55 min flight' },
            text: { es: 'Vuelo directo diario a Sevilla con Lufthansa y unas 2 h 40 min en coche.', en: 'Daily direct flight to Seville with Lufthansa, then about 2 h 40 min by car.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
        ],
      },
      {
        from: { es: 'Florencia', en: 'Florence' },
        options: [
          { mode: 'plane', time: { es: 'Unas 2 h 30 min de vuelo', en: 'About 2 h 30 min flight' },
            text: { es: 'Vuelo directo de Florencia (Peretola) a Madrid con Vueling y después coche, tren o autobús (ver «Madrid»).', en: 'Direct flight from Florence (Peretola) to Madrid with Vueling, then car, train or bus (see “Madrid”).' },
            directions: { from: 'Aeropuerto Adolfo Suárez Madrid-Barajas' } },
          { mode: 'plane', time: { es: 'Unas 2 h 40 min de vuelo', en: 'About 2 h 40 min flight' },
            text: { es: 'Vuelo directo a Sevilla con Volotea desde Florencia (unos 2 a la semana) o con Ryanair desde Pisa (unos 4 a la semana), y unas 2 h 40 min en coche.', en: 'Direct flight to Seville with Volotea from Florence (about 2 a week) or Ryanair from Pisa (about 4 a week), then about 2 h 40 min by car.' },
            directions: { from: 'Aeropuerto de Sevilla' } },
        ],
      },
    ],
  },

  // Dónde dormir (sección propia). Distancias en línea recta desde el restaurante.
  // Datos de Google Maps consultados el 18/10/2026. Para quitar un sitio, borrad su bloque.
  stay: {
    intro: {
      es: 'Villanueva de la Serena y Don Benito están casi pegadas, así que las dos son buena base. Os recomendamos reservar con tiempo.',
      en: 'Villanueva de la Serena and Don Benito are practically next to each other, so either makes a good base. We recommend booking early.',
    },
    groups: [
      {
        title: { es: 'En Villanueva de la Serena', en: 'In Villanueva de la Serena' },
        places: [
          { name: 'Hotel AlJardín', distance: { es: 'A unos 600 m', en: 'About 600 m away' },
            note: { es: 'En la misma Avenida de Chile que el restaurante: se puede volver andando.', en: 'On the same Avenida de Chile as the restaurant: you can walk back.' },
            phone: '+34 924 84 91 65', url: 'https://www.google.com/maps/search/?api=1&query=Hotel%20AlJard%C3%ADn%20Villanueva%20de%20la%20Serena&query_place_id=ChIJ0c_C4aBZFA0RZe903i1OutM' },
          { name: 'Hotel Suites Moma Centro', distance: { es: 'A algo más de 1 km', en: 'Just over 1 km away' },
            note: { es: 'Hotel pequeño en el centro, cerca de la estación de tren y autobuses.', en: 'Small hotel in the town centre, near the train and bus station.' },
            phone: '+34 687 28 95 89', url: 'https://www.google.com/maps/search/?api=1&query=Hotel%20Suites%20Moma%20Centro&query_place_id=ChIJpRPcdABZFA0ROPA0S0QAaVY' },
          { name: 'Hotel Cortijo Santa Cruz', distance: { es: 'A unos 7 km', en: 'About 7 km away' },
            note: { es: 'Antiguo cortijo con patio y piscina en la carretera N-430. Hace falta coche.', en: 'Old farmhouse with a courtyard and pool on the N-430 road. You will need a car.' },
            phone: '+34 924 83 24 15', url: 'https://www.google.com/maps/search/?api=1&query=Hotel%20Cortijo%20Santa%20Cruz&query_place_id=ChIJP4vjCppXFA0Rrg9jSoL-E_A' },
        ],
      },
      {
        title: { es: 'En Don Benito', en: 'In Don Benito' },
        places: [
          { name: 'Hotel Vegas Altas', distance: { es: 'A unos 8 km', en: 'About 8 km away' },
            note: { es: 'Hotel con piscina y restaurante en la avenida de Badajoz.', en: 'Hotel with a pool and restaurant on Avenida de Badajoz.' },
            phone: '+34 924 81 00 05', url: 'https://www.google.com/maps/search/?api=1&query=Hotel%20Vegas%20Altas%20Don%20Benito&query_place_id=ChIJL_RGDhBbFA0RZhUDhDJbWSM' },
          { name: 'Tierra Restaurante Hotel', distance: { es: 'A unos 8 km', en: 'About 8 km away' },
            note: { es: 'Hotel con restaurante, muy bien valorado por quienes lo conocen.', en: 'Hotel with a restaurant, very well reviewed.' },
            phone: '+34 824 91 89 08', url: 'https://www.google.com/maps/search/?api=1&query=Tierra%20Restaurante%20Hotel%20Don%20Benito&query_place_id=ChIJ36Xd84BbFA0RPWY1E_SuQz8' },
        ],
      },
      {
        title: { es: 'Para hacer turismo', en: 'To make a trip of it' },
        places: [
          { name: 'Parador de Mérida', distance: { es: 'A unos 45 min en coche', en: 'About 45 min by car' },
            note: { es: 'En un convento del siglo XVIII en pleno centro, a diez minutos andando del Teatro Romano.', en: 'In an 18th-century convent in the centre, a ten-minute walk from the Roman Theatre.' },
            phone: '+34 924 31 38 00', url: 'https://paradores.es/en/paradores/parador-de-merida' },
        ],
      },
    ],
    // Búsquedas ya preparadas para la noche de la boda (18 → 19 de septiembre de 2027).
    platforms: [
      { name: 'Booking.com', note: { es: 'Hoteles y apartamentos', en: 'Hotels and apartments' },
        url: 'https://www.booking.com/searchresults.html?ss=Villanueva+de+la+Serena%2C+Badajoz&checkin=2027-09-18&checkout=2027-09-19&group_adults=2&no_rooms=1' },
      { name: 'Airbnb', note: { es: 'Casas y pisos enteros', en: 'Whole homes and flats' },
        url: 'https://www.airbnb.com/s/Villanueva-de-la-Serena--Badajoz--Spain/homes?checkin=2027-09-18&checkout=2027-09-19&adults=2' },
    ],
  },

  // Curiosidades de Villanueva (se muestran bajo las preguntas frecuentes).
  curiosities: [
    {
      q: { es: '¿Es verdad que la tortilla de patatas se inventó en Villanueva?', en: 'Is it true the Spanish omelette was invented in Villanueva?' },
      a: {
        es: 'Aquí lo tenemos clarísimo. Un estudio del investigador del CSIC Javier López Linage sitúa la primera tortilla de patatas en Villanueva de la Serena el 27 de febrero de 1798, obra de Joseph de Tena Godoy y Malfeyto, como plato barato para tiempos de hambre. Otros lugares también la reclaman, pero no os recomendamos discutirlo en la boda. Según esa historia, la original no llevaba cebolla: debate cerrado. En 2015 el pueblo cocinó una tortilla gigante con 3.250 huevos.',
        en: 'Locals have no doubt about it. A study by CSIC researcher Javier López Linage places the first potato omelette in Villanueva de la Serena on 27 February 1798, made by Joseph de Tena Godoy y Malfeyto as a cheap dish in times of hunger. Other places claim it too, but we don’t recommend arguing about it at the wedding. According to that story, the original had no onion: debate settled. In 2015 the town cooked a giant omelette with 3,250 eggs.',
      },
    },
    {
      q: { es: '¿Qué tiene que ver Villanueva con Chile?', en: 'What does Villanueva have to do with Chile?' },
      a: {
        es: 'Pedro de Valdivia, que fundó Santiago de Chile en 1541, nació aquí (algunos dicen que en Castuera, pero en Villanueva no se discute). Tiene una estatua en el pueblo, y el restaurante está, cómo no, en la Avenida de Chile.',
        en: 'Pedro de Valdivia, who founded Santiago de Chile in 1541, was born here (some say in nearby Castuera, but not in Villanueva). He has a statue in town, and the restaurant is, of course, on Avenida de Chile.',
      },
    },
    {
      q: { es: '¿Villanueva y Don Benito no eran el mismo pueblo?', en: 'Aren’t Villanueva and Don Benito the same town?' },
      a: {
        es: 'Casi. Están tan cerca que en 2022 votaron fusionarse en una sola ciudad, «Vegas Altas»: en Villanueva dijo que sí el 90 %, y en Don Benito el 66,27 %, apenas por encima del 66 % que hacía falta. Después de las elecciones de 2023 la fusión quedó paralizada, así que siguen siendo dos. Mejor no preguntar en la boda de qué lado está cada uno.',
        en: 'Almost. They are so close that in 2022 they voted to merge into one town, “Vegas Altas”: 90% said yes in Villanueva and 66.27% in Don Benito, just over the 66% required. After the 2023 local elections the merger stalled, so they are still two towns. Best not to ask anyone at the wedding which side they’re on.',
      },
    },
    {
      q: { es: '¿Algún vecino famoso?', en: 'Any famous locals?' },
      a: {
        es: 'José Calderón, base de la selección española de baloncesto y de la NBA, nació en Villanueva. El lema del pueblo es «Puerta soy de La Serena», y por aquí lo llaman simplemente «la Villa».',
        en: 'José Calderón, point guard for the Spanish national basketball team and in the NBA, was born in Villanueva. The town motto is “Puerta soy de La Serena” (“I am the gateway to La Serena”), and locals simply call it “la Villa”.',
      },
    },
    {
      q: { es: '¿Hará calor en septiembre?', en: 'Will it be hot in September?' },
      a: { es: '', en: '' },
      // Gráfico de temperaturas (datos en data/clima-villanueva.json; se recalcula con scripts/clima.py).
      chart: 'clima',
    },
  ],

  // Preguntas frecuentes extra. Las básicas (fecha, lugar, cómo confirmar,
  // acompañantes, alergias, fecha límite…) se generan solas a partir de los
  // datos de arriba y solo aparecen cuando el dato existe.
  // Una pregunta con answer: null no se publica.
  faq: [
    // { q: { es: '¿Habrá autobús?', en: 'Will there be a bus?' }, a: { es: '…', en: '…' } },
  ],

  privacy: {
    // Email de contacto para corrección o borrado de datos. ⚠️ POR CONFIRMAR
    // Mientras sea null, el aviso pide contactar directamente con Isma o Sara.
    contactEmail: null,
    // Hasta cuándo se conservan las respuestas. ⚠️ POR CONFIRMAR
    retainUntil: '2027-12-31',
  },
};
