import React, { useEffect, useRef, useState } from "react";
// Importamos onAuthStateChanged para vigilar la sesión
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
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
import { searchQuery } from "../../store.js"; 
import { X } from "lucide-react";

const imageCache = {};

// CONFIGURACIÓN DE TIEMPO
const MESSAGE_LIFETIME = 60000; // 60 segundos
const FADE_DURATION = 5000;     // 5 segundos degradado

// 👤 AVATAR POR DEFECTO
const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 8v4'/%3E%3Cpath d='M12 16h.01'/%3E%3C/svg%3E`;

export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const starsRef = useRef([]);

	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);

	useEffect(() => {
		// Inicialización de estrellas
		if (starsRef.current.length === 0) {
			for (let i = 0; i < 150; i++) {
				starsRef.current.push({
					x: Math.random(),
					y: Math.random(),
					size: Math.random() * 1.5,
					alpha: Math.random(),
					twinkleSpeed: Math.random() * 0.02,
				});
			}
		}

		let unsubscribeSnapshot = null;

		// 1. ESCUCHA DE AUTENTICACIÓN
		const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
			if (!user) {
				signInAnonymously(auth).catch((error) => console.error("Error Auth Anónimo:", error));
				return;
			}

			// 2. CONEXIÓN A LA BASE DE DATOS (Solo con usuario)
			const q = query(
				collection(db, "thoughts"),
				orderBy("timestamp", "desc"),
				limit(60)
			);

			if (unsubscribeSnapshot) unsubscribeSnapshot();

			unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
				const currentParticlesMap = new Map(
					particlesRef.current.map(p => [p.id, p])
				);
				
				const valid = [];
				
				snapshot.docs.forEach((doc) => {
					const data = doc.data();
					if (data.message) {
						const createdAt = data.timestamp ? data.timestamp.toMillis() : Date.now();

						const avatarUrl = data.photoURL || DEFAULT_AVATAR;
						let imgObj = null;

						if (imageCache[avatarUrl]) {
							imgObj = imageCache[avatarUrl];
						} else {
							const img = new Image();
							if (!avatarUrl.startsWith("data:")) {
								img.crossOrigin = "Anonymous";
								img.referrerPolicy = "no-referrer";
							}
							img.src = avatarUrl;
							imageCache[avatarUrl] = img;
							imgObj = img;
						}

						const existing = currentParticlesMap.get(doc.id);

						valid.push({
							id: doc.id,
							x: existing ? existing.x : Math.random() * window.innerWidth,
							y: existing ? existing.y : Math.random() * window.innerHeight,
							text: data.message,
							category: data.category ? String(data.category).toUpperCase() : "GENERAL",
							uid: data.uid,
							displayName: data.displayName,
							photoURL: data.photoURL, 
							imgElement: imgObj,      
							vx: existing ? existing.vx : (Math.random() - 0.5) * 0.3,
							vy: existing ? existing.vy : (Math.random() - 0.5) * 0.3,
							createdAt: createdAt,
						});
					}
				});
				particlesRef.current = valid;
			}, (error) => {
				console.error("Error escuchando mensajes:", error);
			});
		});

		return () => {
			unsubscribeAuth();
			if (unsubscribeSnapshot) unsubscribeSnapshot();
		};
	}, []);

	const handleCanvasClick = (e) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const clickedParticle = particlesRef.current.find((p) => {
			if (!p.uid) return false;
			const age = Date.now() - p.createdAt;
			if (age > MESSAGE_LIFETIME) return false;

			const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
			return dist < 50; 
		});

		if (clickedParticle) {
			openProfile(clickedParticle);
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

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		let animationId;

		const render = () => {
			if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			}

			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			starsRef.current.forEach((star) => {
				star.alpha += star.twinkleSpeed;
				if (star.alpha > 1 || star.alpha < 0) star.twinkleSpeed *= -1;
				ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
				ctx.beginPath();
				ctx.arc(star.x * canvas.width, star.y * canvas.height, star.size, 0, Math.PI * 2);
				ctx.fill();
			});

			const filterText = searchQuery.get().toLowerCase().trim();
			const now = Date.now();

			particlesRef.current.forEach((p) => {
				const age = now - p.createdAt;
				if (age > MESSAGE_LIFETIME) return; 

				let lifeAlpha = 1;
				if (age > (MESSAGE_LIFETIME - FADE_DURATION)) {
					const timeLeft = MESSAGE_LIFETIME - age;
					lifeAlpha = timeLeft / FADE_DURATION; 
				}

				p.x += p.vx;
				p.y += p.vy;

				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				const matchMessage = p.text.toLowerCase().includes(filterText);
				const matchCategory = p.category.toLowerCase().includes(filterText);

				if (!filterText || matchMessage || matchCategory) {
					ctx.font = "14px monospace";
					ctx.fillStyle = "#ffffff";
					
					const baseAlpha = filterText ? 1 : 0.9;
					const finalAlpha = Math.max(0, baseAlpha * lifeAlpha);
					ctx.globalAlpha = finalAlpha;

					const size = 24;
					const avX = p.x - size - 10;
					const avY = p.y - size / 1.5;

					ctx.beginPath();
					ctx.arc(avX + size / 2, avY + size / 2, size / 2, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(30, 30, 30, ${finalAlpha})`;
					ctx.fill();

					if (p.imgElement && p.imgElement.complete && p.imgElement.naturalHeight !== 0) {
						ctx.save();
						ctx.beginPath();
						ctx.arc(avX + size / 2, avY + size / 2, size / 2, 0, Math.PI * 2);
						ctx.closePath();
						ctx.clip();
						try {
							ctx.drawImage(p.imgElement, avX, avY, size, size);
						} catch (e) {}
						ctx.restore();
					}

					ctx.beginPath();
					ctx.arc(avX + size / 2, avY + size / 2, size / 2, 0, Math.PI * 2);
					ctx.strokeStyle = `rgba(255,255,255,${0.4 * lifeAlpha})`;
					ctx.lineWidth = 1;
					ctx.stroke();

					ctx.fillStyle = "#ffffff";
					ctx.fillText(p.text, p.x, p.y);
					
					ctx.globalAlpha = 1;
				}
			});

			animationId = requestAnimationFrame(render);
		};
		render();
		return () => cancelAnimationFrame(animationId);
	}, []);

	return (
		<>
			<canvas
				ref={canvasRef}
				onClick={handleCanvasClick}
				className="fixed inset-0 w-full h-full bg-black -z-10 cursor-pointer"
			/>

			{selectedProfile && (
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
								profilePosts.map((post, idx) => (
									<div key={idx} className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
										<p className="text-zinc-300 text-sm font-light leading-relaxed">"{post.message}"</p>
										<div className="flex justify-end mt-3">
											<span className="text-[10px] text-emerald-500/70 font-mono uppercase tracking-wider border border-emerald-900/30 px-2 py-0.5 rounded-full bg-emerald-950/20">
												{post.category}
											</span>
										</div>
									</div>
								))
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

// 🚀 CAMBIO FORZADO: Actualización Vercel V2