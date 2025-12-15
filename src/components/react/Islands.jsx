// File: alejandro-m-p/aether-project/aether-project-main/src/components/react/Islands.jsx

import React, { useEffect, useState, useMemo, useRef } from "react";
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
import { searchQuery, availableCategories } from "../../store.js";
import { X, MapPin, Bell } from "lucide-react";

// --- COMPONENTE MAPA (sin cambios) ---
const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.MapComponent }))
		.catch((err) => {
			console.error("Fallo mapa:", err);
			return { default: () => <div className="text-red-500">Error.</div> };
		})
);

// Tiempo de vida de mensajes (ajustable)
const MESSAGE_LIFETIME = 7200000 * 12;

// --- LÓGICA DE NOTIFICACIONES NATIVAS ---
const requestNotificationPermission = () => {
	if (!("Notification" in window)) {
		console.warn("Este navegador no soporta notificaciones de escritorio.");
		return;
	}
	if (Notification.permission !== "granted") {
		Notification.requestPermission().then((permission) => {
			if (permission === "granted") {
				console.log("Permiso de notificación concedido.");
			} else {
				console.log("Permiso de notificación denegado.");
			}
		});
	}
};

const showDesktopNotification = (displayName, message) => {
	if (Notification.permission === "granted") {
		new Notification(`Nueva Señal de ${displayName}`, {
			body: message.substring(0, 100) + (message.length > 100 ? "..." : ""),
			icon: "/favicon.svg", // Utiliza el favicon como icono de la notificación
			tag: "aether-new-signal-" + Date.now(), // Para evitar duplicados
		});
	}
};
// --- FIN LÓGICA DE NOTIFICACIONES NATIVAS ---


export const UniverseCanvas = () => {
	const [rawMessages, setRawMessages] = useState([]);
	const [dataVersion, setDataVersion] = useState(0);

	const [notification, setNotification] = useState(null);
	const isInitialLoad = useRef(true); 

	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);
	const $searchQuery = useStore(searchQuery);

	const cleanupOldThoughts = async () => {
		try {
			const cutoffDate = new Date(Date.now() - MESSAGE_LIFETIME);
			const q = query(
				collection(db, "thoughts"),
				where("timestamp", "<=", cutoffDate)
			);
			const snapshot = await getDocs(q);
			if (!snapshot.empty)
				snapshot.forEach((doc) =>
					deleteDoc(doc.ref).catch((e) => console.error(e))
				);
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

	useEffect(() => {
		cleanupOldThoughts();
		// --- SOLICITAR PERMISO AL CARGAR EL COMPONENTE ---
		requestNotificationPermission();
	}, []);

	// --- REAL-TIME LISTENER ---
	useEffect(() => {
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const receivedData = [];
			const catsSet = new Set();
			let newMessagesCount = 0;

			// Procesar datos
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message && data.location) {
					const catRaw = data.category
						? String(data.category).trim()
						: "GENERAL";
					const cat = catRaw.length > 0 ? catRaw.toUpperCase() : "GENERAL";

					receivedData.push({
						id: doc.id,
						...data,
						category: cat,
					});
					catsSet.add(cat);
				}
			});

			// --- LÓGICA DE NOTIFICACIÓN ---
			if (!isInitialLoad.current) {
				snapshot.docChanges().forEach((change) => {
					if (change.type === "added") {
						newMessagesCount++;
					}
				});

				if (newMessagesCount > 0) {
					const latestMessage = receivedData[0];
					
					// 1. Mostrar notificación nativa del escritorio
					showDesktopNotification(
						latestMessage.displayName || "Anónimo",
						latestMessage.message
					);
					
					// 2. Mostrar notificación en la aplicación (fallback visual)
					setNotification({
						message: latestMessage.message,
						displayName: latestMessage.displayName,
					});

					// Auto-ocultar después de 5 segundos
					setTimeout(() => setNotification(null), 5000);
				}
			} else {
				isInitialLoad.current = false;
			}
			// --- FIN LÓGICA DE NOTIFICACIÓN ---

			setRawMessages(receivedData);
			setDataVersion((v) => v + 1);

			availableCategories.set(Array.from(catsSet).sort());
		});
		return () => unsubscribe();
	}, []);

	const processedMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();
		return rawMessages.filter((p) => {
			if (!filterText) return true;
			return p.category.toLowerCase().includes(filterText);
		});
	}, [rawMessages, $searchQuery]);

	return (
		<>
			{/* --- NOTIFICACIÓN DE NUEVO MENSAJE (rounded-xl) --- */}
			{notification && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] p-4 max-w-sm w-full pointer-events-none">
					<div
						// Contenedor de notificación: rounded-xl (Estructural)
						className="bg-cyan-900/80 backdrop-blur-md border border-cyan-500/50 text-white p-4 rounded-xl shadow-xl animate-in slide-in-from-top-full duration-300 flex items-start gap-4 pointer-events-auto"
						role="alert"
					>
						<Bell className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
						<div className="flex-grow min-w-0">
							<p className="font-mono text-xs uppercase text-cyan-400 mb-1 tracking-widest">
								Nueva Señal Detectada
							</p>
							<p className="text-sm font-semibold truncate">
								{notification.displayName || "Anónimo"}
							</p>
							<p className="text-xs text-zinc-300 italic truncate line-clamp-2">
								"{notification.message}"
							</p>
						</div>
						<button
							onClick={() => setNotification(null)}
							className="text-zinc-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
							aria-label="Cerrar notificación"
						>
							<X size={16} />
						</button>
					</div>
				</div>
			)}
			{/* --- FIN NOTIFICACIÓN --- */}

			<div className="fixed inset-0 w-full h-full bg-black -z-10">
				<React.Suspense
					fallback={
						<div className="text-zinc-600 font-mono text-xs p-4">
							Cargando universo...
						</div>
					}
				>
					<MapComponent
						messages={processedMessages}
						openProfile={openProfileMemo}
						version={dataVersion}
					/>
				</React.Suspense>
			</div>

			{selectedProfile && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
					<div 
					// Contenedor principal: rounded-xl (Estructural)
					className="bg-zinc-950/95 border border-cyan-500/20 p-6 w-full max-w-md relative shadow-2xl rounded-xl">
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
										// Post item: rounded-full
										className="bg-zinc-900 p-3 rounded-full border border-zinc-800"
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