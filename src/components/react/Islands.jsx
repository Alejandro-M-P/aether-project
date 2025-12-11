import React, {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
} from "react"; // <-- ACT: Importar useCallback
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	getDocs,
	query,
	orderBy,
	limit,
	where,
} from "firebase/firestore";

import { auth, db } from "../../firebase.js";
import {
	searchQuery,
	isLoggedIn,
	draftMessage,
	mapKey,
	fetchTrigger,
} from "../../store.js"; // <-- ACT: Importar fetchTrigger
import { useStore } from "@nanostores/react";
import { X, MapPin } from "lucide-react";
import { addRandomOffset } from "./ControlBar.jsx";

// ACT: Configuramos el intervalo de lectura a 5 minutos (300,000 ms)
const POLLING_INTERVAL = 300000;

// 🚨 CRÍTICO: Carga dinámica para MapComponent.jsx
const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.MapComponent }))
		.catch((err) => {
			console.error("Fallo al cargar MapComponent dinámicamente:", err);
			return {
				default: () => (
					<div className="text-red-500">
						Error: Mapa no cargado (Verifique MapComponent.jsx)
					</div>
				),
			};
		})
);

const imageCache = {};

// CONFIGURACIÓN DE TIEMPO
const MESSAGE_LIFETIME = 86400000; // 24 horas

// CONFIGURACIÓN DE PROXIMIDAD
const PROXIMITY_DEGREES = 0.05;

// Función de distancia Euclidiana simplificada (para la lógica de proximidad)
const distanceBetween = (loc1, loc2) => {
	if (!loc1 || !loc2) return Infinity;
	const dLat = loc1.lat - loc2.lat;
	const dLon = loc1.lon - loc2.lon;
	return Math.sqrt(dLat * dLat + dLon * dLon);
};

// 👤 AVATAR POR DEFECTO
const DEFAULT_AVATAR = "/target-user.svg";

export const UniverseCanvas = () => {
	const particlesRef = useRef([]);

	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);

	// ESTADO: Ubicación PRECISA del usuario (para cálculo de proximidad)
	const [preciseLocation, setPreciseLocation] = useState(null);
	// NUEVO ESTADO: Ubicación RANDOMIZADA para el mapa y el pop-up
	const [displayLocation, setDisplayLocation] = useState(null);

	const [nearbyThoughtExists, setNearbyThoughtExists] = useState(false);
	const [currentMapZoom, setCurrentMapZoom] = useState(2);

	// ACT: Leer estados de los stores
	const $isLoggedIn = useStore(isLoggedIn);
	const $draftMessage = useStore(draftMessage);
	const $mapKey = useStore(mapKey);
	const $fetchTrigger = useStore(fetchTrigger); // <-- NUEVO: Leer gatillo

	// Mantenemos openProfile como una función que se pasa al MapComponent
	const openProfile = async (user) => {
		setSelectedProfile(user);
		setLoadingProfile(true);
		setProfilePosts([]);

		try {
			const q = query(
				collection(db, "thoughts"),
				where("uid", "==", user.uid),
				orderBy("timestamp", "desc"),
				limit(5)
			);
			const querySnapshot = await getDocs(q);
			const posts = [];
			querySnapshot.forEach((doc) => {
				posts.push(doc.data());
			});
			setProfilePosts(posts);
		} catch (error) {
			console.error("Error cargando perfil", error);
		} finally {
			setLoadingProfile(false);
		}
	};

	// Memorizar openProfile para evitar re-renders innecesarios en MapComponent
	const openProfileMemo = useMemo(() => openProfile, []);

	// Función para actualizar el zoom del mapa (pasada al MapComponent)
	const updateZoom = useMemo(
		() => (zoom) => {
			setCurrentMapZoom(zoom);
		},
		[]
	);

	// ACT: Función de lectura de datos como useCallback (se puede llamar manualmente)
	const fetchData = useCallback(async () => {
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		let nearbyFound = false;

		try {
			const snapshot = await getDocs(q);

			const currentParticlesMap = new Map(
				particlesRef.current.map((p) => [p.id, p])
			);

			const valid = [];
			nearbyFound = false;

			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message) {
					const createdAt = data.timestamp
						? data.timestamp.toMillis()
						: Date.now();

					const avatarUrl = data.photoURL || DEFAULT_AVATAR;
					let imgObj = null;

					if (imageCache[avatarUrl]) {
						imgObj = imageCache[avatarUrl];
					} else if (typeof window !== "undefined") {
						const img = new Image();
						if (!avatarUrl.startsWith("data:")) {
							img.crossOrigin = "Anonymous";
							img.referrerPolicy = "no-referrer";
						}
						img.src = avatarUrl;
						imageCache[avatarUrl] = img;
						imgObj = img;
					}
					// ---------------------------------

					const existing = currentParticlesMap.get(doc.id);
					const location = data.location || null;
					const cityName = data.cityName || null; // Leer Ciudad
					const countryName = data.countryName || null; // Leer País
					let isNearby = false;

					// Usamos preciseLocation (coordenadas precisas) para la lógica de distancia
					if (preciseLocation && location) {
						const dist = distanceBetween(preciseLocation, location);
						if (dist < PROXIMITY_DEGREES) {
							isNearby = true;
							nearbyFound = true;
						}
					}

					valid.push({
						id: doc.id,
						text: data.message,
						category: data.category
							? String(data.category).toUpperCase()
							: "GENERAL",
						uid: data.uid,
						displayName: data.displayName,
						photoURL: data.photoURL,
						imgElement: imgObj,
						createdAt: createdAt,
						location: location,
						cityName: cityName,
						countryName: countryName,
						isNearby: isNearby,
					});
				}
			});

			// Filtrar mensajes expirados antes de guardarlos
			particlesRef.current = valid.filter(
				(p) => Date.now() - p.createdAt <= MESSAGE_LIFETIME
			);

			// Si el texto de búsqueda está activo, no considerar el zoom de cercanía
			const filterText = searchQuery.get().toLowerCase().trim();
			setNearbyThoughtExists(nearbyFound && !filterText);
		} catch (error) {
			console.error("Error al obtener datos de Firestore (Quota?):", error);
		}
	}, [preciseLocation]); // Depende solo de preciseLocation

	useEffect(() => {
		if (!auth.currentUser) {
			signInAnonymously(auth).catch(() => {});
		}

		// OBTENER UBICACIÓN DEL VISUALIZADOR
		if (typeof window !== "undefined" && "geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const newPreciseLocation = {
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					};
					setPreciseLocation(newPreciseLocation);

					// ACT: Randomizar la ubicación para mostrarla en el mapa y en el pop-up draft
					setDisplayLocation(addRandomOffset(newPreciseLocation));
				},
				(error) => {
					console.warn("Geolocalización del visor denegada o fallida.", error);
					setPreciseLocation(null);
					setDisplayLocation(null);
				}
			);
		}

		// 1. POLLING (CADA 5 MINUTOS)
		fetchData();
		const intervalId = setInterval(fetchData, POLLING_INTERVAL);

		return () => clearInterval(intervalId);
	}, [preciseLocation, fetchData]);

	// 2. ESCUCHAR EL GATILLO DE ESCRITURA
	useEffect(() => {
		// Cada vez que fetchTrigger cambia, forzamos una lectura manual
		fetchData();
	}, [$fetchTrigger, fetchData]);

	// Preparar los mensajes para el mapa (filtrados por búsqueda)
	const filteredMessages = useMemo(() => {
		const filterText = searchQuery.get().toLowerCase().trim();
		// Ya están filtrados por expiración en el onSnapshot, solo queda el filtro de búsqueda
		return particlesRef.current.filter((p) => {
			if (!filterText) return true;
			return (
				p.text.toLowerCase().includes(filterText) ||
				p.category.toLowerCase().includes(filterText)
			);
		});
	}, [searchQuery.get()]);

	return (
		<>
			{/* Contenedor del Mapa (Se mostrará solo en el cliente) */}
			<div className="w-full h-full -z-10 bg-black">
				{/* Suspense muestra un fallback mientras el componente del mapa carga */}
				<React.Suspense
					fallback={
						<div className="flex items-center justify-center w-full h-full text-zinc-500 font-mono">
							Cargando Mapa...
						</div>
					}
				>
					{/* CRÍTICO: SOLO renderizar si hay usuario (logueado o anónimo) */}
					{$isLoggedIn ? (
						<MapComponent
							key={$mapKey}
							messages={filteredMessages}
							viewerLocation={displayLocation}
							nearbyThoughtExists={nearbyThoughtExists}
							openProfile={openProfileMemo}
							updateZoom={updateZoom}
							currentMapZoom={currentMapZoom}
							draftMessage={$draftMessage}
						/>
					) : (
						<div className="flex items-center justify-center w-full h-full text-zinc-500 font-mono">
							Conectando con AETHER...
						</div>
					)}
				</React.Suspense>
			</div>

			{/* ... (resto del código del modal de perfil) */}
		</>
	);
};

export default function Islands() {
	return null;
}
