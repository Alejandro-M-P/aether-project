import React, { useEffect, useRef, useState, useMemo } from "react";
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	onSnapshot,
	query,
	orderBy,
	limit,
	where,
	getDocs,
} from "firebase/firestore";

import { auth, db } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";
import { X, MapPin } from "lucide-react";

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
const MESSAGE_LIFETIME = 60000; // 60 segundos

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
const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 8v4'/%3E%3Cpath d='M12 16h.01'/%3E%3C/svg%3E`;

export const UniverseCanvas = () => {
	const particlesRef = useRef([]);

	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);

	// ESTADO: Ubicación del usuario que ve el mapa
	const [viewerLocation, setViewerLocation] = useState(null);
	const [nearbyThoughtExists, setNearbyThoughtExists] = useState(false);
	const [currentMapZoom, setCurrentMapZoom] = useState(2); // Estado para el zoom del mapa

	// [CORRECCIÓN] Estado para forzar re-renderizado de partículas (Soluciona Bug 1)
	const [particlesLoadedVersion, setParticlesLoadedVersion] = useState(0);

	// [CORRECCIÓN] Suscripción reactiva al store de búsqueda (Soluciona Bug 2)
	const $searchQuery = useStore(searchQuery);

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

	useEffect(() => {
		if (!auth.currentUser) {
			signInAnonymously(auth).catch(() => {});
		}

		// OBTENER UBICACIÓN DEL VISUALIZADOR
		if (typeof window !== "undefined" && "geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setViewerLocation({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					});
				},
				(error) => {
					console.warn("Geolocalización del visor denegada o fallida.", error);
					setViewerLocation(null);
				}
			);
		}

		// LÓGICA DE FIREBASE PARA PARTÍCULAS/MENSAJES
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		let nearbyFound = false;

		const unsubscribe = onSnapshot(q, (snapshot) => {
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

					// Usamos location (coordenadas precisas) para la lógica de distancia
					if (viewerLocation && location) {
						const dist = distanceBetween(viewerLocation, location);
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

			// [CORRECCIÓN] Forzar el re-renderizado al actualizar la lista de partículas
			setParticlesLoadedVersion((v) => v + 1);

			// Si el texto de búsqueda está activo, no considerar el zoom de cercanía
			const filterText = $searchQuery.toLowerCase().trim();
			setNearbyThoughtExists(nearbyFound && !filterText);
		});
		return () => unsubscribe();
		// [CORRECCIÓN] Añadir $searchQuery a las dependencias
	}, [viewerLocation, openProfileMemo, $searchQuery]);

	// Preparar los mensajes para el mapa (filtrados por búsqueda)
	const filteredMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();
		// Ya están filtrados por expiración en el onSnapshot, solo queda el filtro de búsqueda
		return particlesRef.current.filter((p) => {
			if (!filterText) return true;
			return (
				p.text.toLowerCase().includes(filterText) ||
				p.category.toLowerCase().includes(filterText)
			);
		});
		// [CORRECCIÓN] Añadir particlesLoadedVersion y $searchQuery como dependencias
	}, [particlesLoadedVersion, $searchQuery]);

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
					<MapComponent
						messages={filteredMessages}
						viewerLocation={viewerLocation}
						nearbyThoughtExists={nearbyThoughtExists}
						openProfile={openProfileMemo}
						updateZoom={updateZoom} // Pasar la función de actualización de zoom
						currentMapZoom={currentMapZoom} // Pasar el zoom actual
					/>
				</React.Suspense>
			</div>

			{selectedProfile && (
				// Modal de Perfil de Usuario
				<div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
					<div className="bg-zinc-950 border border-white/10 p-6 rounded-2xl w-full max-w-md relative shadow-2xl ring-1 ring-white/10">
						<button
							onClick={() => setSelectedProfile(null)}
							className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
						>
							<X size={20} />
						</button>

						<div className="flex flex-col items-center mb-8">
							<div className="relative">
								<img
									src={selectedProfile.photoURL || "/favicon.svg"}
									alt="Profile"
									className="w-20 h-20 rounded-full border-2 border-zinc-800 object-cover"
								/>
								<div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.1)] pointer-events-none"></div>
							</div>
							<h2 className="text-white font-mono text-xl mt-4 tracking-tight">
								{selectedProfile.displayName || "Viajero Anónimo"}
							</h2>
							<p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-1">
								Historial de Transmisiones
							</p>
						</div>

						<div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
							{loadingProfile ? (
								<div className="text-center py-8">
									<span className="text-zinc-600 font-mono text-xs animate-pulse">
										Recuperando datos...
									</span>
								</div>
							) : profilePosts.length > 0 ? (
								profilePosts.map((post, idx) => {
									// Determinar el nombre de ubicación a mostrar en el modal
									const displayLocation =
										post.cityName ||
										post.countryName ||
										"Ubicación Desconocida";

									return (
										<div
											key={idx}
											className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
										>
											<p className="text-zinc-300 text-sm font-light leading-relaxed">
												"{post.message}"
											</p>
											<div className="flex justify-end mt-3 items-center">
												{post.countryName && (
													<span className="text-[10px] text-sky-500/70 font-mono uppercase tracking-wider border border-sky-900/30 px-2 py-0.5 rounded-full bg-sky-950/20 mr-2 flex items-center gap-1">
														<MapPin size={10} /> {displayLocation}
													</span>
												)}
												<span className="text-[10px] text-emerald-500/70 font-mono uppercase tracking-wider border border-emerald-900/30 px-2 py-0.5 rounded-full bg-emerald-950/20">
													{post.category}
												</span>
											</div>
										</div>
									);
								})
							) : (
								<p className="text-center text-zinc-600 font-mono text-xs py-4">
									No hay transmisiones recientes visibles.
								</p>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default function Islands() {
	return null;
}
