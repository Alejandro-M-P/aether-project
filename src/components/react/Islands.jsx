import React, { useEffect, useRef, useState, useMemo } from "react";
import {
	collection,
	onSnapshot,
	query,
	orderBy,
	limit,
	where,
	getDocs,
	deleteDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";
import { X, MapPin } from "lucide-react";

// Carga dinámica del MapComponent
const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.MapComponent }))
		.catch((err) => {
			console.error("Fallo al cargar MapComponent:", err);
			return {
				default: () => (
					<div className="flex items-center justify-center h-full text-red-500">
						Error cargando mapa.
					</div>
				),
			};
		})
);

// 2 Horas de duración
const MESSAGE_LIFETIME = 7200000;
const PROXIMITY_DEGREES = 0.05;

const distanceBetween = (loc1, loc2) => {
	if (!loc1 || !loc2) return Infinity;
	const dLat = loc1.lat - loc2.lat;
	const dLon = loc1.lon - loc2.lon;
	return Math.sqrt(dLat * dLat + dLon * dLon);
};

export const UniverseCanvas = () => {
	// Usamos 'rawDocs' para guardar lo que viene de Firebase sin procesar
	const rawDocsRef = useRef([]);
	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const [viewerLocation, setViewerLocation] = useState(null);
	// Este estado sirve para forzar la actualización visual cuando llegan datos
	const [dataVersion, setDataVersion] = useState(0);
	const $searchQuery = useStore(searchQuery);

	// --- LIMPIEZA AUTOMÁTICA ---
	const cleanupOldThoughts = async () => {
		try {
			const cutoffDate = new Date(Date.now() - MESSAGE_LIFETIME);
			const q = query(
				collection(db, "thoughts"),
				where("timestamp", "<=", cutoffDate)
			);
			const snapshot = await getDocs(q);
			if (!snapshot.empty) {
				snapshot.forEach((doc) =>
					deleteDoc(doc.ref).catch((e) => console.error(e))
				);
			}
		} catch (error) {
			console.warn("Limpieza:", error);
		}
	};

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
			querySnapshot.forEach((doc) => posts.push({ id: doc.id, ...doc.data() }));
			setProfilePosts(posts);
		} catch (error) {
			console.error("Error perfil", error);
		} finally {
			setLoadingProfile(false);
		}
	};

	const openProfileMemo = useMemo(() => openProfile, []);

	// EFECTO 1: SOLO GEOLOCALIZACIÓN
	useEffect(() => {
		cleanupOldThoughts();
		if (typeof window !== "undefined" && "geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					setViewerLocation({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					});
				},
				(error) => console.warn("Geo error:", error),
				{ enableHighAccuracy: false, timeout: 10000 }
			);
		}
	}, []); // Solo se ejecuta al montar, no depende de nada más

	// EFECTO 2: SOLO CONEXIÓN A FIREBASE
	useEffect(() => {
		// Obtenemos los últimos 60 mensajes
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const rawData = [];
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message && data.location) {
					const createdAt = data.timestamp
						? data.timestamp.toMillis()
						: Date.now();
					const isExpired = Date.now() - createdAt > MESSAGE_LIFETIME;

					if (!isExpired) {
						// Guardamos los datos crudos, la distancia se calcula después
						rawData.push({
							id: doc.id,
							...data,
							category: data.category
								? String(data.category).toUpperCase()
								: "GENERAL",
							createdAt: createdAt,
						});
					}
				}
			});
			// Guardamos en referencia y avisamos a React para que pinte
			rawDocsRef.current = rawData;
			setDataVersion((v) => v + 1);
		});
		return () => unsubscribe();
	}, []); // IMPORTANTE: Array vacío. La conexión NO se reinicia si te mueves.

	// PROCESAMIENTO: Aquí unimos Datos + Búsqueda + GPS
	const processedMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();

		return rawDocsRef.current
			.filter((p) => {
				if (!filterText) return true;
				return (
					p.message.toLowerCase().includes(filterText) ||
					p.category.toLowerCase().includes(filterText)
				);
			})
			.map((p) => {
				// Calculamos la distancia aquí, en tiempo real
				let isNearby = false;
				if (viewerLocation && p.location) {
					const dist = distanceBetween(viewerLocation, p.location);
					if (dist < PROXIMITY_DEGREES) isNearby = true;
				}
				return { ...p, isNearby, text: p.message }; // Aseguramos que 'text' existe para el mapa
			});
	}, [dataVersion, $searchQuery, viewerLocation]); // Se recalcula si cambia algo de esto

	return (
		<>
			<div className="fixed inset-0 w-full h-full bg-black -z-10">
				<React.Suspense
					fallback={
						<div className="text-zinc-600 font-mono text-xs p-4">
							Cargando Aether...
						</div>
					}
				>
					<MapComponent
						messages={processedMessages}
						openProfile={openProfileMemo}
					/>
				</React.Suspense>
			</div>

			{selectedProfile && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
					<div className="bg-zinc-950/95 border border-cyan-500/20 p-6 w-full max-w-md relative shadow-2xl rounded-xl">
						<button
							onClick={() => setSelectedProfile(null)}
							className="absolute top-4 right-4 text-zinc-500 hover:text-white"
						>
							<X size={20} />
						</button>
						<div className="flex flex-col items-center mb-6">
							<img
								src={selectedProfile.photoURL || "/favicon.svg"}
								className="w-20 h-20 rounded-full border-2 border-cyan-400 bg-black object-cover"
							/>
							<h2 className="text-white font-mono text-xl mt-4 uppercase tracking-widest">
								{selectedProfile.displayName || "Viajero"}
							</h2>
						</div>
						<div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
							{loadingProfile ? (
								<p className="text-center text-cyan-500 text-xs animate-pulse">
									Cargando...
								</p>
							) : (
								profilePosts.map((p) => (
									<div
										key={p.id}
										className="bg-zinc-900 p-3 rounded border border-zinc-800"
									>
										<p className="text-zinc-300 text-sm italic">
											"{p.message}"
										</p>
										<div className="flex justify-end mt-2 gap-2">
											{p.cityName && (
												<span className="text-[10px] text-zinc-500 flex items-center">
													<MapPin size={10} className="mr-1" /> {p.cityName}
												</span>
											)}
											<span className="text-[10px] text-emerald-400 border border-emerald-900 px-1">
												{p.category}
											</span>
										</div>
									</div>
								))
							)}
							{!loadingProfile && profilePosts.length === 0 && (
								<p className="text-center text-zinc-600 text-xs">
									Sin transmisiones recientes.
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
