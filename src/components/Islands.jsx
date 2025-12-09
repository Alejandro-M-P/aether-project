import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, X } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	addDoc,
	deleteDoc,
	onSnapshot,
	serverTimestamp,
	query,
	orderBy,
	limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../store";

// --- BARRA DE BÚSQUEDA (Minimalista) ---
export const SearchBar = () => {
	const $searchQuery = useStore(searchQuery);

	return (
		<div className="w-full animate-in fade-in duration-1000">
			<div className="relative group">
				{/* Icono de Lupa sutil */}
				<div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
					<Search className="h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
				</div>

				{/* Input de búsqueda: Borde fino, fondo semi-transparente, texto discreto */}
				<input
					type="text"
					value={$searchQuery}
					onChange={(e) => searchQuery.set(e.target.value)}
					className="w-full bg-black/50 border border-white/20 rounded-lg py-2.5 pl-10 pr-4 text-white/90 text-sm font-light placeholder-white/30 focus:outline-none focus:border-white/50 transition-all shadow-md"
					placeholder="filtrar el vacío..."
				/>
			</div>
		</div>
	);
};

// --- CANVAS DEL UNIVERSO (Sin cambios en lógica) ---
export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const starsRef = useRef([]);

	useEffect(() => {
		signInAnonymously(auth).catch(() => {});

		if (starsRef.current.length === 0) {
			for (let i = 0; i < 150; i++) {
				starsRef.current.push({
					x: Math.random(),
					y: Math.random(),
					size: Math.random() * 1.2,
					alpha: Math.random() * 0.5 + 0.1,
				});
			}
		}

		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(100)
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const now = Date.now();
			const valid = [];

			snapshot.docs.forEach((doc) => {
				const data = doc.data();
				if (!data.timestamp) {
					valid.push(createParticle(data));
					return;
				}

				const createdAt = data.timestamp.toMillis();
				if (now - createdAt > 120000) {
					deleteDoc(doc.ref).catch(() => {});
					return;
				}

				valid.push(createParticle(data));
			});

			particlesRef.current = valid;
		});

		return () => unsubscribe();
	}, []);

	const createParticle = (data) => ({
		x: Math.random() * window.innerWidth,
		y: Math.random() * window.innerHeight,
		text: data.message || "...",
		category: (data.category || "").toLowerCase(),
		vx: (Math.random() - 0.5) * 0.15,
		vy: (Math.random() - 0.5) * 0.15,
		color: "#ffffff",
		baseAlpha: Math.random() * 0.6 + 0.2,
	});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		let animationId;

		const render = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			ctx.fillStyle = "#050505";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			starsRef.current.forEach((star) => {
				ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
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

			const filterText = searchQuery.get().toLowerCase();

			particlesRef.current.forEach((p) => {
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				const match =
					!filterText ||
					p.text.toLowerCase().includes(filterText) ||
					p.category.includes(filterText);

				if (match) {
					ctx.globalAlpha = p.baseAlpha;
					ctx.fillStyle = p.color;
					ctx.font = "300 13px monospace";
					ctx.fillText(p.text, p.x, p.y);
				}
			});

			ctx.globalAlpha = 1;

			animationId = requestAnimationFrame(render);
		};

		render();
		return () => cancelAnimationFrame(animationId);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 -z-10 bg-black pointer-events-none"
			style={{ zIndex: -9999 }}
		/>
	);
};

// --- TRANSMISOR (Botón Minimalista y Modal Oscuro) ---
export const Transmitter = () => {
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [isSending, setIsSending] = useState(false);

	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;

		setIsSending(true);

		try {
			await addDoc(collection(db, "thoughts"), {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
			});

			setMsg("");
			setCat("");
			setOpen(false);
		} finally {
			setIsSending(false);
		}
	};

	if (!open)
		return (
			// Botón Lanzador: Cuadrado, borde sutil, icono fino
			<button
				onClick={() => setOpen(true)}
				className="bg-black/50 border border-white/20 rounded-lg p-3 text-white/50 hover:text-white/80 hover:border-white/40 transition-all duration-300"
			>
				<Plus size={28} strokeWidth={1} />
			</button>
		);

	return (
		// Modal: Fondo muy oscuro y desenfoque, alineado al centro
		<div className="fixed inset-0 bg-black/98 backdrop-blur-sm z-9999 flex items-center justify-center p-8">
			<div className="w-full max-w-2xl relative">
				<button
					onClick={() => setOpen(false)}
					className="absolute -top-16 right-0 text-white/20 hover:text-white/60"
				>
					<X size={24} strokeWidth={1} />
				</button>

				<div className="bg-black border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl">
					<form onSubmit={send} className="space-y-8">
						<input
							value={cat}
							onChange={(e) => setCat(e.target.value)}
							placeholder="CATEGORÍA"
							className="w-full bg-transparent border-b border-white/10 py-3 text-white/50 text-xs tracking-[0.3em] text-center uppercase focus:outline-none"
						/>

						<textarea
							value={msg}
							onChange={(e) => setMsg(e.target.value)}
							className="w-full bg-transparent text-white/80 text-xl md:text-3xl font-light text-center resize-none placeholder-white/20 focus:outline-none"
							placeholder="escribe tu pensamiento..."
							rows={4}
							maxLength={100}
							autoFocus
						/>

						<button
							disabled={isSending}
							className="w-full bg-white/5 border border-white/10 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/10 hover:border-white/20 uppercase tracking-[0.3em] py-4 disabled:opacity-30"
						>
							{isSending ? "ENVIANDO..." : "LIBERAR AL VACÍO"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
};

// --- COMPONENTE PRINCIPAL (Modificado) ---
export default function Islands() {
	return (
		// Devolvemos el Canvas y la Barra de Control/Lanzador envueltos.
		<>
			<UniverseCanvas />
			{/* Contenedor que agrupa la UI flotante */}
			<div className="relative z-20">
				{/* La posición la daremos desde index.astro al usar las etiquetas <SearchBar/> y <Transmitter/> */}
				<SearchBar />
				<Transmitter />
			</div>
		</>
	);
}
