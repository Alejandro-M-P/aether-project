import React, { useEffect, useState, useMemo } from "react";
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
// Importamos la nueva variable availableCategories
import { searchQuery, availableCategories } from "../../store.js";
import { X, MapPin } from "lucide-react";

const MapComponent = React.lazy(() =>
	import("./MapComponent.jsx")
		.then((mod) => ({ default: mod.MapComponent }))
		.catch((err) => {
			console.error("Fallo mapa:", err);
			return { default: () => <div className="text-red-500">Error.</div> };
		})
);

const MESSAGE_LIFETIME = 7200000;

export const UniverseCanvas = () => {
	const [rawMessages, setRawMessages] = useState([]);
	const [dataVersion, setDataVersion] = useState(0);

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
	}, []);

	// REAL-TIME LISTENER
	useEffect(() => {
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const receivedData = [];
			const catsSet = new Set(); // Usamos un Set para evitar duplicados

			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message && data.location) {
					// Normalizamos la categoría (mayúsculas, sin espacios extra)
					const cat = data.category
						? String(data.category).toUpperCase().trim()
						: "GENERAL";
					receivedData.push({
						id: doc.id,
						...data,
						category: cat,
					});
					// Añadimos la categoría a la lista
					if (cat) catsSet.add(cat);
				}
			});

			setRawMessages(receivedData);
			setDataVersion((v) => v + 1);

			// ACTUALIZAMOS LA STORE GLOBAL: Convertimos el Set a Array y ordenamos
			availableCategories.set(Array.from(catsSet).sort());
		});
		return () => unsubscribe();
	}, []);

	const processedMessages = useMemo(() => {
		const filterText = $searchQuery.toLowerCase().trim();
		return rawMessages.filter((p) => {
			if (!filterText) return true;
			// Filtro exacto por categoría para el desplegable
			return p.category.toLowerCase().includes(filterText);
		});
	}, [rawMessages, $searchQuery]);

	return (
		<>
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
