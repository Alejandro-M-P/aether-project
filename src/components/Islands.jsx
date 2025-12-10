import React, { useEffect, useRef, useState } from "react";
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
import { auth, db } from "../firebase";
import { searchQuery } from "../store";
import { X } from "lucide-react";

// Caché para no recargar imágenes en cada frame
const imageCache = {};

export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const starsRef = useRef([]);

	// Estados para el perfil modal
	const [selectedProfile, setSelectedProfile] = useState(null);
	const [profilePosts, setProfilePosts] = useState([]);
	const [loadingProfile, setLoadingProfile] = useState(false);

	// 1. CARGA DE DATOS
	useEffect(() => {
		if (!auth.currentUser) {
			signInAnonymously(auth).catch(() => {});
		}

		// Estrellas de fondo
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

		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(60)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const valid = [];
			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (data.message) {
					// Precargar imagen
					let imgObj = null;
					if (data.photoURL) {
						if (imageCache[data.photoURL]) {
							imgObj = imageCache[data.photoURL];
						} else {
							const img = new Image();
							img.src = data.photoURL;
							img.crossOrigin = "Anonymous"; // Importante para canvas
							imageCache[data.photoURL] = img;
							imgObj = img;
						}
					}

					valid.push({
						x: Math.random() * window.innerWidth,
						y: Math.random() * window.innerHeight,
						text: data.message,
						category: data.category
							? String(data.category).toUpperCase()
							: "GENERAL",
						// Datos usuario
						uid: data.uid,
						displayName: data.displayName,
						photoURL: data.photoURL,
						imgElement: imgObj,
						// Física
						vx: (Math.random() - 0.5) * 0.3,
						vy: (Math.random() - 0.5) * 0.3,
					});
				}
			});
			particlesRef.current = valid;
		});
		return () => unsubscribe();
	}, []);

	// 2. MANEJO DE CLIC (ABRIR PERFIL)
	const handleCanvasClick = (e) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Detectar clic cerca de un mensaje
		const clickedParticle = particlesRef.current.find((p) => {
			if (!p.uid) return false;
			// Calculamos distancia al punto del texto/avatar
			const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
			return dist < 50; // Radio de clic generoso
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

	// 3. RENDERIZADO (DIBUJAR AVATAR + TEXTO)
	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		let animationId;

		const render = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;

			// Fondo negro
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			// Estrellas
			starsRef.current.forEach((star) => {
				star.alpha += star.twinkleSpeed;
				if (star.alpha > 1 || star.alpha < 0) star.twinkleSpeed *= -1;
				ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
				ctx.beginPath();
				ctx.arc(
					star.x * canvas.width,
					star.y * canvas.height,
					star.size,
					0,
					Math.PI * 2
				);
				ctx.fill();
			});

			const filterText = searchQuery.get().toLowerCase().trim();

			particlesRef.current.forEach((p) => {
				p.x += p.vx;
				p.y += p.vy;

				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				const matchMessage = p.text.toLowerCase().includes(filterText);
				const matchCategory = p.category.toLowerCase().includes(filterText);

				if (!filterText || matchMessage || matchCategory) {
					ctx.font = "14px monospace";
					ctx.fillStyle = "#ffffff";
					ctx.globalAlpha = filterText ? 1 : 0.9;

					// --- DIBUJAR AVATAR ---
					if (
						p.imgElement &&
						p.imgElement.complete &&
						p.imgElement.naturalHeight !== 0
					) {
						const size = 24;
						// Posición: A la IZQUIERDA (x - tamaño - margen)
						const avX = p.x - size - 10;
						const avY = p.y - size / 1.5; // Centrado verticalmente respecto al texto

						ctx.save();
						ctx.beginPath();
						ctx.arc(avX + size / 2, avY + size / 2, size / 2, 0, Math.PI * 2);
						ctx.closePath();
						ctx.clip();
						ctx.drawImage(p.imgElement, avX, avY, size, size);
						ctx.restore();

						// Borde blanco sutil
						ctx.beginPath();
						ctx.arc(avX + size / 2, avY + size / 2, size / 2, 0, Math.PI * 2);
						ctx.strokeStyle = "rgba(255,255,255,0.4)";
						ctx.lineWidth = 1;
						ctx.stroke();
					}

					// --- DIBUJAR TEXTO ---
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

			{/* MODAL DE PERFIL */}
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
									<div
										key={idx}
										className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
									>
										<p className="text-zinc-300 text-sm font-light leading-relaxed">
											"{post.message}"
										</p>
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
