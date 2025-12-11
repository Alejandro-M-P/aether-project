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

// Carga dinámica del mapa (ahora es el Globo 3D)
const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.UniverseCanvas })) 
		.catch((err) => {
			console.error("Fallo al cargar MapComponent:", err);
			return {
				default: () => (
					<div className="flex items-center justify-center h-full text-red-500">
						Error de Sistema: Mapa no disponible.
					</div>
				),
			};
		})
);

// Configuración
const MESSAGE_LIFETIME = 60000; // 60 segundos
const PROXIMITY_DEGREES = 0.05;
const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 8v4'/%3E%3Cpath d='M12 16h.01'/%3E%3C/svg%3E`;

// Distancia simple
const distanceBetween = (loc1, loc2) => {
	if (!loc1 || !loc2) return Infinity;
	const dLat = loc1.lat - loc2.lat;
	const dLon = loc1.lon - loc2.lon;
	return Math.sqrt(dLat * dLat + dLon * dLon);
};

export const UniverseCanvas = () => {
	const particlesRef = useRef([]);
	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [viewerLocation, setViewerLocation] = useState(null);
	
	// Estado para forzar re-render
	const [particlesLoadedVersion, setParticlesLoadedVersion] = useState(0);
	const $searchQuery = useStore(searchQuery);

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
			querySnapshot.forEach((doc) => posts.push(doc.data()));
			setProfilePosts(posts);
		} catch (error) {
			console.error("Error cargando perfil", error);
		} finally {
			setLoadingProfile(false);
		}
	};

	const openProfileMemo = useMemo(() => openProfile, []);

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

		// FIREBASE LISTENER
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(500)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const valid = [];
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message) {
					const createdAt = data.timestamp ? data.timestamp.toMillis() : Date.now();
					
					// Lógica de proximidad
					let isNearby = false;
					if (viewerLocation && data.location) {
						const dist = distanceBetween(viewerLocation, data.location);
						if (dist < PROXIMITY_DEGREES) isNearby = true;
					}

					valid.push({
						id: doc.id,
						text: data.message,
						category: data.category ? String(data.category).toUpperCase() : "GENERAL",
						uid: data.uid,
						displayName: data.displayName,
						photoURL: data.photoURL,
						createdAt: createdAt,
						location: data.location || null,
						cityName: data.cityName || null,
						countryName: data.countryName || null,
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
		});
		return () => unsubscribe();
	}, [viewerLocation, openProfileMemo]);

	const filteredMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();
		return particlesRef.current.filter((p) => {
			if (!filterText) return true;
			return (
				p.text.toLowerCase().includes(filterText) ||
				p.category.toLowerCase().includes(filterText)
			);
		});
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
				// MODAL PERFIL (Minimalista)
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
					<div className="bg-black border border-zinc-800 p-6 w-full max-w-md relative shadow-2xl">
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
									className="w-20 h-20 rounded-full border-2 border-zinc-800 object-cover grayscale"
								/>
							</div>
							<h2 className="text-white font-mono text-xl mt-4 tracking-widest uppercase">
								{selectedProfile.displayName || "Viajero"}
							</h2>
							<p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest mt-1">
								Historial de Transmisiones
							</p>
						</div>

						<div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
							{loadingProfile ? (
								<div className="text-center py-8">
									<span className="text-zinc-600 font-mono text-xs animate-pulse">
										Descifrando datos...
									</span>
								</div>
							) : profilePosts.length > 0 ? (
								profilePosts.map((post, idx) => (
									<div
										key={idx}
										className="bg-zinc-950 p-4 border border-zinc-900 hover:border-zinc-700 transition-colors"
									>
										<p className="text-zinc-400 text-sm font-light leading-relaxed italic">
											"{post.message}"
										</p>
										<div className="flex justify-end mt-3 items-center gap-2">
											{post.countryName && (
												<span className="text-[10px] text-zinc-600 font-mono uppercase">
													{post.cityName || post.countryName}
												</span>
											)}
											<span className="text-[10px] text-emerald-600 font-mono uppercase border border-emerald-900/30 px-2 py-0.5">
												{post.category}
											</span>
										</div>
									</div>
								))
							) : (
								<p className="text-center text-zinc-700 font-mono text-xs py-4">
									Silencio absoluto en este canal.
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