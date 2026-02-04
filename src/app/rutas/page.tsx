"use client";

import { CheckSquare, ChevronDown, Map, Square } from "lucide-react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";

const ROUTES = [
  { id: 1, name: "Ruta 1 Centro" },
  { id: 2, name: "Ruta 2 Zona Ley Vieja - Mercado Juan Carrasco" },
  { id: 3, name: "Ruta 3 Mercado De la Juarez, Pino Suares-Gabriel Leyva" },
  { id: 4, name: "Ruta 4 Urias-Mazatlan II-Villas del Sol" },
  { id: 5, name: "Ruta 5 Praderas" },
  { id: 6, name: "Ruta 6 Zona Dorada" },
  { id: 7, name: "Ruta 7 Pancho Villa-Sanchez Celis" },
  { id: 8, name: "Ruta 8 Pancho Villa-Sanchez Celis 2" },
];

const ROUTE_CLIENTS: Record<number, string[]> = {
  1: [
    "abarrote la piramide mercado centro PINO",
    "fruteria ALICIA 513 centro",
    "OXXO AZUETA CUL",
    "OXXO KIARA CUL",
    "OXXO BARRAGAN CUL",
    "fruteria ALICIA 521 centro",
    "DULCERIA VALDEZ CENTRO",
    "OXXO ALIANZA",
    "KIOSKO MZT 4153 ZARAGOZA",
    "fruteria ALICIA 515 centro",
    "cremeria osuna",
    "KIOSKO MZT 4165 PASEO OLAS ALTAS",
    "OXXO OLAS ALTAS CUL",
    "OXXO PLAYA NORTE CUL",
    "KIOSKO MZT 4138 PASEO CLAUSSEN",
    "fruteria portillo",
    "cremeria tirado",
    "OXXO BOLIVAR",
    "OXXO TELEGRAFOS CUL",
    "OXXO LEANDRO VALLE CUL",
    "OXXO ZARAGOZA II CUL",
    "KIOSKO MZT 4157 MIGUEL ALEMAN",
    "OXXO PLAYA SUR CUL",
  ],
  2: [
    "OXXO CARVAJAL CUL NO ALTA",
    "OXXO FERROCARRILERA CUL",
    "OXXO NAJERA CUL",
    "OXXO RIO PIAXTLA CUL",
    "OXXO ESTERO CUL",
    "OXXO MULTIFAMILIARES CUL",
    "OXXO SHIMIZU",
    "OXXO LOS RIOS CUL",
    "OXXO PARADISE CUL",
    "OXXO TELLERIA CUL",
    "OXXO RIO BALUARTE CUL",
    "OXXO FERRUSQUILLA CUL",
    "OXXO UNIVERSIDAD CUL",
    "OXXO ROTARISMO CUL",
  ],
  3: [
    "OXXO MUELLE CUL",
    "OXXO BONFIL CUL",
    "OXXO LA 13 CUL",
    "dulceria cronchilandia",
    "pescaderia­a puerto viejo",
    "deposito mariscos pulpo",
    "DULCERIA VALDEZ JUAREZ",
    "el tucan",
    "tortilleria tios",
    "fruteria juarez mercado",
    "OXXO OBRERA CUL",
    "KIOSKO MZT 4186 JUAREZ INTERNACIONAL",
    "KIOSKO MZT 4143 JUAREZ",
    "KIOSKO MZT 4118 GABRIEL LEYVA",
    "fruteria ALICIA 512 benito juarez",
    "fruteria ALICIA 523 benito juarez",
    "abarrote karla",
    "tortilleria olimpica",
    "OXXO INDEPENDENCIA CUL",
    "OXXO PINO SUAREZ CUL",
    "abarrote humberto",
    "KIOSKO MZT 4115 ALFREDO BONFIL",
    "KIOSKO MZT 4116 LAS AMERICAS",
    "OXXO PRIMERA CUL",
    "OXXO VILLA GALAXIA CUL",
    "KIOSKO MZT 4180 OLIMPICA",
    "OXXO KLEIN CUL",
    "fruteria el chinito",
    "fruteria la casa de la fruta",
    "fruteria ALICIA 516 pino suarez",
    "OXXO EL CABALLITO CUL",
    "KIOSKO MZT 4177 PINO SUAREZ",
    "pescaderia pepetun juarez",
    "KIOSKO MZT 4133 EL MARINO",
  ],
  4: [
    "KIOSKO MZT 4166 AZALEA",
    "OXXO CALANDRIAS CUL",
    "OXXO VALLE DEL SOL CUL",
    "KIOSKO MZT 4185 GAS URIAS",
    "KIOSKO MZT 4152 VALLE DE URIAS",
    "fruteria don cande",
    "OXXO PASCUAL OROZCO",
    "KIOSKO MZT 4164 UNIVERSO",
    "OXXO GAS URIAS CUL",
    "OXXO HOSPITAL MILITAR CUL",
    "OXXO SANTA TERESITA",
    "KIOSKO MZT 4187 VILLAS DEL SOL",
    "OXXO TALLERES CUL",
    "OXXO GARDENIAS CUL",
    "OXXO EL CONCHI CUL",
    "carnicerÃ­a los colimos",
    "KIOSKO MZT 4129 GASMAZ",
    "KIOSKO MZT 4189 SANTA TERESA",
    "OXXO GIRASOLES",
    "OXXO VILLAS DEL REY CUL",
    "fruteria carnicera bringas",
    "OXXO CERRO COLORADO CUL",
    "KIOSKO MZT 4130 GAS LA SIRENA",
    "KIOSKO MZT 4136 GASMAZ COLOSIO",
    "OXXO ACAPULCO CUL",
    "fruteria mari",
    "KIOSKO MZT 4125 FLORES MAGON",
    "OXXO LOS SAUCES CUL",
  ],
  5: [
    "KIOSKO MZT 4124 JACARANDAS",
    "pescaderia la padera",
    "KIOSKO MZT 4101 PROGRESO",
    "OXXO PETROPLAZA CUL",
    "KIOSKO MZT 4160 MONTE RIBEREÑO",
    "Dulceria valdez hacienda VICTORIA",
    "pescaderia la pradera",
    "fruteria ALICIA 525 pradera dorada",
    "OXXO MAGUEYES",
    "OXXO TECNOLOGICO",
    "KIOSKO MZT 4174 RÍO TONALÁ",
    "OXXO PAPAGAYO CUL",
    "KIOSKO MZT 4144 PRADERA DORADA",
    "KIOSKO MZT 4163 PUENTE RIO PRESIDIO",
    "KIOSKO MZT 4104 EL WALAMO",
    "KIOSKO MZT 4162 URBIVILLAS",
    "KIOSKO MZT 4113 DOÑA CHONITA",
    "fruteria ALICIA 524 ladrillera",
    "fruteria trejo",
    "KIOSKO MZT 4178 ESTADIO",
    "OXXO CADETES CUL",
    "OXXO LIBRAMIENTO 3 CUL",
    "KIOSKO MZT 4146 LAURELES",
    "OXXO VALPARAISO CUL",
    "KIOSKO MZT 4134 MUNICH",
    "OXXO GAS MUNICH CUL",
    "KIOSKO MZT 4102 LAS MAÑANITAS",
    "fruteria ALICIA 518 las mañanitas",
    "abarrote villamar",
    "carnicería el lucero",
    "fruteria ALICIA 510 mar de cortez",
    "dulceria garcia",
    "tios villa verde",
    "fruteria ALICIA 520 lomas del ebano",
    "ley CERRO COLORADO",
    "fruteria ALICIA 502 FLORES MAGON",
    "OXXO JARIPILLO CUL",
    "KIOSKO MZT 4188 VALLE BONITO",
    "OXXO SAN JOAQUIN CUL",
  ],
  6: [
    "KIOSKO MZT 4120 CAMARON SABALO",
    "OXXO PLAZA BONITA CUL",
    "OXXO EL TOREO CUL",
    "OXXO COSTA DE ORO CUL",
    "OXXO GAVIOTAS CUL",
    "OXXO LAGUNA CUL",
    "OXXO LAS GARZAS CUL",
    "el aguachilon",
    "KIOSKO MZT 4137 ZONA DORADA",
    "OXXO Cubilete CUL",
    "OXXO SABALO CUL",
    "super lomas",
    "fruteria conejos",
    "OXXO PLAYAS CUL",
    "fruteria hnos osante",
    "KIOSKO MZT 4149 CITY EXPRESS",
    "KIOSKO MZT 4117 EL CID",
    "KIOSKO MZT 4107 CIRCUNVALACION",
    "venados market",
    "KIOSKO MZT 4145 RAFAEL BUELNA",
    "super modelorama",
    "OXXO CROWNE PLAZA CUL",
    "KIOSKO MZT 4170 GAS CERRITOS",
    "KIOSKO MZT 4150 CERRITOS PLAYA",
    "OXXO CERRITOS CUL",
    "KIOSKO MZT 4168 GAS CARDONES",
    "OXXO VILLAS DE RUEDA CUL",
    "KIOSKO MZT 4135 CERRITOS",
    "OXXO CONDESA CUL",
    "OXXO ATUN CUL",
    "KIOSKO MZT 4179 LOMAS DE MAZATLAN",
    "OXXO EL TIBURON CUL",
    "KIOSKO MZT 4147 SABALO COUNTRY",
    "OXXO DEL SOL CUL",
    "OXXO COSTAVELEROS",
    "OXXO GALERIAS CUL",
    "OXXO DELFIN CUL",
    "KIOSKO MZT 4181 PACEO DEL PACIFICO",
    "OXXO FLORIDA CUL",
    "OXXO PLAYA BRUJAS CUL",
  ],
  7: [
    "KIOSKO MZT 4112 SANTA ROSA",
    "KIOSKO MZT 20 DE NOVIEMBRE",
    "KIOSKO MZT 4142 ALAMEDA",
    "OXXO ALAMEDA CUL",
    "tortilleria lizarraga",
    "fruteria ALICIA 503 FRANCISCO VILLA",
    "OXXO MARISCAL CUL",
    "abarrote amandita",
    "pescados luis",
    "KIOSKO MZT 4119 INSURGENTES MAZATLAN",
    "abarrote tiznado",
    "deposito mariscos yuly",
    "abarrote lizarraga",
    "KIOSKO MZT SALVADOR ALLENDE",
    "OXXO BUELNA CUL",
    "abarrote mony",
    "abarrote carniceria don luis",
    "abarrote dalia",
    "fruteria ALICIA 514 sanchez celis",
    "fruteria sinaloa",
    "abarrote zamora",
    "OXXO PAREDON CUL",
    "OXXO LAS GAVIAS",
    "ley BICENTENARIO EXP",
    "abarrote krisel",
    "KIOSKO MZT 4103 LIBERTAD EXPRESION",
    "OXXO LA MARINA CUL",
    "Dulceria VALDEZ GRAN PLAZA",
    "tortilleria la unica",
    "OXXO GRAN PLAZA II CUL",
    "OXXO ANDES CUL",
    "Dulceria VALDEZ BICENTENARIO",
    "abarrote la cochera",
    "abarrote el milagro",
    "abarrote ely",
    "ab. Silvia",
    "OXXO CEIBA CUL",
    "DULCERIA VALDEZ LEY MAR",
    "fruteria ALICIA 522 jardines del bosque",
  ],
  8: [
    "fruteria hermanos bernal",
    "ab tony",
    "fruteria yoly",
    "mariscos kamila",
    "pescadería donnchuy",
    "OXXO SATELITE CUL",
    "fruteria ALICIA 504 VILLA GALAXIA",
    "abarrotes los gordos",
    "KIOSKO MZT 4128 VILLA GALAXIA",
    "KIOSKO MZT 4175 MONTE VERDE",
    "mariscos hieleras",
    "OXXO PEREZ ARCE CUL",
    "pescaderia yojis",
    "polleria la granjita",
    "fruteria los pirus",
    "OXXO GAS GUZMAN",
    "OXXO EJERCITO CUL",
    "OXXO GUASAVE CUL",
    "abarrote portillo",
    "abarrotes el ahorro",
    "abarrote don Luis",
    "abarrote portillos",
    "abarrote ale",
    "supermercado zamora",
    "carniceria el rosario",
    "pescaderia cindy",
    "fruteria el maca",
    "fruteria ALICIA 509 CASA BLANCA",
    "abarrote zr",
    "fruteria ALICIA 519 dorados de villa",
    "OXXO BICENTENARIO CUL",
    "KIOSKO MZT 4122 DEL DELFIN",
    "tortilleria santa fe",
    "carniceria la suerte",
    "deposito mariscos carpa",
    "pescaderia los delfines",
    "fruteria del ahorro",
    "fruteria rosa",
    "fruteria quintero",
    "OXXO CORONEL CUL",
  ],
};

type CompletedClientsData = {
  [userEmail: string]: {
    [routeId: string]: string[];
  };
};

// Add this type for route status
type RouteStatus = "Sin empezar" | "En curso" | "Terminada";

// Add this function to get route status
const getRouteStatus = (
  routeId: number,
  completedClients: Set<string>,
): RouteStatus => {
  const routeClients = ROUTE_CLIENTS[routeId];
  if (!routeClients) return "Sin empezar";

  const completedCount = routeClients.filter((client) =>
    completedClients.has(client),
  ).length;
  const percentage = (completedCount / routeClients.length) * 100;

  if (percentage === 0) return "Sin empezar";
  if (percentage === 100) return "Terminada";
  return "En curso";
};

// Add this function to get status badge color
const getStatusColor = (status: RouteStatus): string => {
  switch (status) {
    case "Sin empezar":
      return "bg-gray-100 text-gray-600";
    case "En curso":
      return "bg-blue-100 text-blue-600";
    case "Terminada":
      return "bg-green-100 text-green-600";
  }
};

export default function RutasPage() {
  const [selectedRoute, setSelectedRoute] = useState("");
  const [completedClients, setCompletedClients] = useState<Set<string>>(
    new Set(),
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/api/auth/signin");
    },
  });

  // Load saved route and progress when component mounts
  useEffect(() => {
    if (session?.user?.email) {
      // Load last selected route
      const savedRoute = localStorage.getItem(
        `lastRoute_${session.user.email}`,
      );
      if (savedRoute) {
        setSelectedRoute(savedRoute);
      }

      // Load progress for the saved route
      const savedData = localStorage.getItem("routeProgress");
      if (savedData && savedRoute) {
        const parsedData: CompletedClientsData = JSON.parse(savedData);
        const userProgress = parsedData[session.user.email]?.[savedRoute];
        if (userProgress) {
          setCompletedClients(new Set(userProgress));
        }
      }
    }
  }, [session?.user?.email]);

  // Load progress when route changes
  useEffect(() => {
    if (session?.user?.email && selectedRoute) {
      // Save selected route
      localStorage.setItem(`lastRoute_${session.user.email}`, selectedRoute);

      // Load progress for the new route
      const savedData = localStorage.getItem("routeProgress");
      if (savedData) {
        const parsedData: CompletedClientsData = JSON.parse(savedData);
        const userProgress = parsedData[session.user.email]?.[selectedRoute];
        if (userProgress) {
          setCompletedClients(new Set(userProgress));
        } else {
          setCompletedClients(new Set());
        }
      }
    }
  }, [selectedRoute, session?.user?.email]);

  // Save progress whenever it changes
  const saveProgress = (newCompletedSet: Set<string>) => {
    if (!session?.user?.email || !selectedRoute) return;

    const savedData = localStorage.getItem("routeProgress");
    const parsedData: CompletedClientsData = savedData
      ? JSON.parse(savedData)
      : {};

    if (!parsedData[session.user.email]) {
      parsedData[session.user.email] = {};
    }

    parsedData[session.user.email][selectedRoute] = Array.from(newCompletedSet);

    localStorage.setItem("routeProgress", JSON.stringify(parsedData));
  };

  const toggleClient = (client: string) => {
    setCompletedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(client)) {
        newSet.delete(client);
      } else {
        newSet.add(client);
      }
      saveProgress(newSet);
      return newSet;
    });
  };

  // Clear route progress for the current user and route
  const clearRouteProgress = () => {
    if (!session?.user?.email || !selectedRoute) return;

    setCompletedClients(new Set());

    const savedData = localStorage.getItem("routeProgress");
    if (savedData) {
      const parsedData: CompletedClientsData = JSON.parse(savedData);
      if (parsedData[session.user.email]) {
        delete parsedData[session.user.email][selectedRoute];
        localStorage.setItem("routeProgress", JSON.stringify(parsedData));
      }
    }
  };

  const getProgress = () => {
    if (!selectedRoute) return 0;
    const routeClients = ROUTE_CLIENTS[parseInt(selectedRoute, 10)];
    if (!routeClients) return 0;
    return (completedClients.size / routeClients.length) * 100;
  };

  // Add this function to get all routes progress
  const getAllRoutesProgress = (): Record<number, Set<string>> => {
    if (!session?.user?.email) return {};

    const savedData = localStorage.getItem("routeProgress");
    if (!savedData) return {};

    const parsedData: CompletedClientsData = JSON.parse(savedData);
    const userProgress = parsedData[session.user.email] || {};

    return Object.entries(userProgress).reduce(
      (acc, [routeId, clients]) => {
        acc[parseInt(routeId, 10)] = new Set(clients);
        return acc;
      },
      {} as Record<number, Set<string>>,
    );
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 font-sans w-full"
      style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8rem" }}
    >
      <AppHeader title="Rutas" icon={Map} />
      <main className="px-4 py-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex justify-between items-center"
            >
              <span className="text-gray-700">
                {selectedRoute
                  ? ROUTES.find((r) => r.id.toString() === selectedRoute)?.name
                  : "Seleccionar Ruta"}
              </span>
              <div className="flex items-center gap-2">
                {selectedRoute && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      getRouteStatus(
                        parseInt(selectedRoute, 10),
                        completedClients,
                      ),
                    )}`}
                  >
                    {getRouteStatus(
                      parseInt(selectedRoute, 10),
                      completedClients,
                    )}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="py-1 max-h-60 overflow-auto">
                  {ROUTES.map((route) => {
                    const allProgress = getAllRoutesProgress();
                    const routeStatus = getRouteStatus(
                      route.id,
                      allProgress[route.id] || new Set(),
                    );
                    return (
                      <div
                        key={route.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedRoute(route.id.toString());
                          setIsDropdownOpen(false);
                        }}
                      >
                        <span className="text-sm text-gray-700">
                          {route.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(routeStatus)}`}
                        >
                          {routeStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedRoute && ROUTE_CLIENTS[parseInt(selectedRoute, 10)] && (
          <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Clientes de la Ruta
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearRouteProgress}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Reiniciar
                </button>
                <span className="text-xs text-gray-500">
                  {completedClients.size} de{" "}
                  {ROUTE_CLIENTS[parseInt(selectedRoute, 10)].length}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 h-1.5 rounded-full mb-4">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${getProgress()}%` }}
              />
            </div>

            <div className="space-y-2">
              {ROUTE_CLIENTS[parseInt(selectedRoute, 10)].map(
                (client, index) => (
                  <div
                    key={index}
                    className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => toggleClient(client)}
                  >
                    {completedClients.has(client) ? (
                      <CheckSquare className="h-5 w-5 text-blue-600 mr-2" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 mr-2" />
                    )}
                    <span
                      className={`text-sm ${completedClients.has(client) ? "text-gray-400 line-through" : "text-gray-700"}`}
                    >
                      {client}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
