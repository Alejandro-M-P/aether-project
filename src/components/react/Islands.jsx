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
	doc,
	updateDoc,
	arrayUnion,
	arrayRemove,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery, availableCategories } from "../../store.js";
import { X, MapPin, Bell } from "lucide-react";

// --- COMPONENTE MAPA ---
const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.MapComponent }))
		.catch((err) => {
			console.error("Fallo mapa:", err);
			return { default: () => <div className="text-red-500">Error.</div> };
		})
);

const MESSAGE_LIFETIME = 3600000; // 1 hora

// --- LÓGICA DE NOTIFICACIONES ---
const requestNotificationPermission = () => {
	if (!("Notification" in window)) return;
	if (Notification.permission !== "granted") {
		Notification.requestPermission();
	}
};

const showDesktopNotification = (title, body) => {
	if (Notification.permission === "granted") {
		new Notification(title, {
			body: body,
			icon: "/favicon.svg",
			tag: "aether-notification-" + Date.now(),
		});
	}
};

export const UniverseCanvas = () => {
	const [rawMessages, setRawMessages] = useState([]);
	const [dataVersion, setDataVersion] = useState(0);
	const [currentUser, setCurrentUser] = useState(null);

	// Referencias para mantener estado dentro del listener de Firestore
	const currentUserRef = useRef(null);
	const messagesCacheRef = useRef(new Map());

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
			if (!snapshot.empty) snapshot.forEach((doc) => deleteDoc(doc.ref));
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

	// --- FUNCIÓN DE VOTOS (Rápida) ---
	const handleVote = async (thoughtId, voteType) => {
		if (!currentUser) return;

		const message = rawMessages.find((m) => m.id === thoughtId);
		if (!message) return;

		const uid = currentUser.uid;
		const likes = message.likedBy || [];
		const dislikes = message.dislikedBy || [];
		const isLiked = likes.includes(uid);
		const isDisliked = dislikes.includes(uid);
		const ref = doc(db, "thoughts", thoughtId);

		try {
			if (voteType === "likes") {
				if (isLiked) {
					await updateDoc(ref, { likedBy: arrayRemove(uid) });
				} else {
					await updateDoc(ref, {
						likedBy: arrayUnion(uid),
						dislikedBy: arrayRemove(uid),
					});
				}
			} else if (voteType === "dislikes") {
				if (isDisliked) {
					await updateDoc(ref, { dislikedBy: arrayRemove(uid) });
				} else {
					await updateDoc(ref, {
						dislikedBy: arrayUnion(uid),
						likedBy: arrayRemove(uid),
					});
				}
			}
		} catch (error) {
			console.error("Error al votar:", error);
		}
	};

	const openProfileMemo = useMemo(() => openProfile, []);

	useEffect(() => {
		cleanupOldThoughts();
		requestNotificationPermission();
		const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
			setCurrentUser(user);
			currentUserRef.current = user;
		});
		return () => unsubscribeAuth();
	}, []);

	// --- LISTENER EN TIEMPO REAL ---
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
			let voteNotification = null;

			snapshot.docChanges().forEach((change) => {
				const docId = change.doc.id;
				const newData = change.doc.data();
				const oldData = messagesCacheRef.current.get(docId);

				// 1. Detección de NUEVOS mensajes
				if (change.type === "added") {
					messagesCacheRef.current.set(docId, newData);
					if (!isInitialLoad.current) newMessagesCount++;
				}

				// 2. Detección de MODIFICACIONES (Votos)
				if (change.type === "modified" && oldData && !isInitialLoad.current) {
					const oldLikes = oldData.likedBy || [];
					const newLikes = newData.likedBy || [];
					const oldDislikes = oldData.dislikedBy || [];
					const newDislikes = newData.dislikedBy || [];

					// Comprobar si han aumentado los likes o dislikes
					const likeAdded = newLikes.length > oldLikes.length;
					const dislikeAdded = newDislikes.length > oldDislikes.length;

					if (likeAdded || dislikeAdded) {
						// IMPORTANTE: Solo notificar si el mensaje es MÍO
						// Comprobamos si el usuario actual es el dueño del mensaje
						const amIOwner =
							currentUserRef.current &&
							newData.uid === currentUserRef.current.uid;

						// Averiguar quién votó (solo para asegurarnos de no notificarnos a nosotros mismos si nos damos autolike)
						const diffLikes = newLikes.filter((uid) => !oldLikes.includes(uid));
						const diffDislikes = newDislikes.filter(
							(uid) => !oldDislikes.includes(uid)
						);
						const voterUid = diffLikes[0] || diffDislikes[0];
						const amIVoter =
							currentUserRef.current && voterUid === currentUserRef.current.uid;

						if (amIOwner && !amIVoter) {
							// El mensaje es personalizado para el dueño
							const actionText = likeAdded
								? "te ha dado un 👍"
								: "te ha dado un 👎";
							voteNotification = {
								title: "Nueva reacción",
								body: `Alguien ${actionText} en tu señal: "${newData.message}"`,
							};
						}
					}
					// Actualizamos la caché con los nuevos datos
					messagesCacheRef.current.set(docId, newData);
				}

				if (change.type === "removed") {
					messagesCacheRef.current.delete(docId);
				}
			});

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
						likedBy: data.likedBy || [],
						dislikedBy: data.dislikedBy || [],
						category: cat,
					});
					catsSet.add(cat);
				}
			});

			// --- MOSTRAR NOTIFICACIONES ---
			if (!isInitialLoad.current) {
				if (newMessagesCount > 0) {
					const latest = receivedData[0];
					// Solo notificar mensajes nuevos que NO son míos
					if (
						currentUserRef.current &&
						latest.uid !== currentUserRef.current.uid
					) {
						showDesktopNotification(
							`Nueva Señal de ${latest.displayName || "Anónimo"}`,
							latest.message
						);
						setNotification({
							title: "Nueva Señal Detectada",
							displayName: latest.displayName,
							message: latest.message,
						});
						setTimeout(() => setNotification(null), 5000);
					}
				} else if (voteNotification) {
					// Notificación de voto (solo para mí, definida arriba)
					showDesktopNotification(
						voteNotification.title,
						voteNotification.body
					);
					setNotification({
						title: voteNotification.title,
						displayName: "Sistema",
						message: voteNotification.body,
					});
					setTimeout(() => setNotification(null), 5000);
				}
			} else {
				isInitialLoad.current = false;
			}

			setRawMessages(receivedData);
			setDataVersion((v) => v + 1);
			availableCategories.set(Array.from(catsSet).sort());
		});
		return () => unsubscribe();
	}, []);

	const processedMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();
		const uid = currentUser?.uid;

		return rawMessages
			.filter((p) => {
				if (!filterText) return true;
				return p.category.toLowerCase().includes(filterText);
			})
			.map((p) => ({
				...p,
				likes: p.likedBy ? p.likedBy.length : 0,
				dislikes: p.dislikedBy ? p.dislikedBy.length : 0,
				isLiked: uid ? p.likedBy?.includes(uid) : false,
				isDisliked: uid ? p.dislikedBy?.includes(uid) : false,
			}));
	}, [rawMessages, $searchQuery, currentUser]);

	return (
		<>
			{notification && (
				<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] p-4 max-w-sm w-full pointer-events-none">
					<div className="bg-cyan-900/80 backdrop-blur-md border border-cyan-500/50 text-white p-4 rounded-xl shadow-xl animate-in slide-in-from-top-full duration-300 flex items-start gap-4 pointer-events-auto">
						<Bell className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
						<div className="flex-grow min-w-0">
							<p className="font-mono text-xs uppercase text-cyan-400 mb-1 tracking-widest">
								{notification.title}
							</p>
							<p className="text-sm font-semibold truncate">
								{notification.displayName || "Anónimo"}
							</p>
							<p className="text-xs text-zinc-300 italic truncate line-clamp-2">
								{notification.message.startsWith('"')
									? notification.message
									: `"${notification.message}"`}
							</p>
						</div>
						<button
							onClick={() => setNotification(null)}
							className="text-zinc-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
						>
							<X size={16} />
						</button>
					</div>
				</div>
			)}

			<div className="fixed inset-0 w-full h-full bg-black -z-10">
				<React.Suspense
					fallback={
						<div className="text-zinc-600 font-mono text-xs p-4">
							Cargando...
						</div>
					}
				>
					<MapComponent
						messages={processedMessages}
						openProfile={openProfileMemo}
						version={dataVersion}
						onVote={handleVote}
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
									Sin transmisiones.
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
