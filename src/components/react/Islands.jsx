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
		.then((mod) => ({ default: mod.MapComponent }))
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
			querySnapshot.forEach((doc) => posts.push({id: doc.id, ...doc.data()}));
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

		if (typeof window !== "undefined" && "geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setViewerLocation({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					});
				},
				(error) => console.warn("Geo error:", error)
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

			particlesRef.current = valid.filter((p) => Date.now() - p.createdAt <= MESSAGE_LIFETIME);
			setParticlesLoadedVersion((v) => v + 1);
		});
		return () => unsubscribe();
	}, [viewerLocation]);

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
			{/* FONDO NEGRO Y MAPA 3D */}
			<div className="fixed inset-0 w-full h-full bg-black -z-10">
				<React.Suspense
					fallback={
						<div className="flex items-center justify-center w-full h-full bg-black text-zinc-600 font-mono text-xs uppercase tracking-widest animate-pulse">
							Inicializando Secuencia Aether...
						</div>
					}
				>
					<MapComponent
						messages={filteredMessages}
						openProfile={openProfileMemo}
					/>
				</React.Suspense>
			</div>

			{selectedProfile && (
				// MODAL PERFIL (Minimalista)
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
					<div className="bg-black/95 border border-cyan-500/20 p-6 w-full max-w-md relative shadow-[0_0_80px_rgba(6,182,212,0.2)] backdrop-blur-md ring-1 ring-white/5">
						<button
							onClick={() => setSelectedProfile(null)}
							className="absolute top-4 right-4 text-zinc-500 hover:text-cyan-400 transition-colors hover:drop-shadow-[0_0_5px_rgba(6,182,212,1)]"
						>
							<X size={20} />
						</button>

						<div className="flex flex-col items-center mb-8">
							<div className="relative">
								<img
									src={selectedProfile.photoURL || "/favicon.svg"}
									alt="Profile"
									className="w-20 h-20 rounded-full border-2 border-cyan-400 object-cover bg-black"
								/>
							</div>
							<h2 className="text-white font-mono text-xl mt-4 tracking-widest uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
								{selectedProfile.displayName || "Viajero"}
							</h2>
							<p className="text-cyan-400 text-[10px] font-mono uppercase tracking-widest mt-1">
								Historial de Transmisiones
							</p>
						</div>

						<div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
							{loadingProfile ? (
								<div className="text-center py-8">
									<span className="text-cyan-500 font-mono text-xs animate-pulse">
										Descifrando datos...
									</span>
								</div>
							) : profilePosts.length > 0 ? (
								profilePosts.map((post) => (
									<div
										key={post.id}
										className="bg-zinc-950 p-4 border border-zinc-900 hover:border-emerald-700/50 transition-all duration-300"
									>
										<p className="text-zinc-400 text-sm font-light leading-relaxed italic border-l border-zinc-700 pl-3">
											"{post.message}"
										</p>
										<div className="flex justify-end mt-3 items-center gap-2">
											{post.countryName && (
												<span className="text-[10px] text-zinc-600 font-mono uppercase flex items-center">
													<MapPin size={10} className="mr-1 text-zinc-700"/>
													{post.cityName || post.countryName}
												</span>
											)}
											<span className="text-[10px] text-emerald-400 font-mono uppercase border border-emerald-900/30 px-2 py-0.5 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
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