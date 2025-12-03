import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Search } from "lucide-react";
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	addDoc,
	onSnapshot,
	serverTimestamp,
	query,
	orderBy,
	limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../store";

export const SearchBar = () => {
	const $searchQuery = useStore(searchQuery);
	return (
		<div className="relative group w-full max-w-xs">
			<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
				<Search className="h-4 w-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
			</div>
			<input
				type="text"
				value={$searchQuery}
				onChange={(e) => searchQuery.set(e.target.value)}
				className="block w-full pl-10 pr-3 py-2 border border-zinc-800 rounded-full bg-black/50 text-zinc-300 text-xs placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-all backdrop-blur-sm"
				placeholder="Filtrar tema (ej: miedo)..."
			/>
		</div>
	);
};

export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);

	useEffect(() => {
		signInAnonymously(auth).catch(console.error);
		const q = query(
			collection(db, "thoughts"),
			orderBy("timestamp", "desc"),
			limit(100)
		);
		return onSnapshot(q, (snapshot) => {
			particlesRef.current = snapshot.docs.map((doc) => {
				const data = doc.data();
				return {
					x: Math.random() * window.innerWidth,
					y: Math.random() * window.innerHeight,
					text: data.message,
					category: (data.category || "").toLowerCase(),
					vx: (Math.random() - 0.5) * 0.3,
					vy: (Math.random() - 0.5) * 0.3,
					color:
						data.category === "fear"
							? "#60a5fa"
							: data.category === "love"
							? "#f87171"
							: "#ffffff",
					baseAlpha: Math.random() * 0.5 + 0.2,
				};
			});
		});
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		let animationId;

		const render = () => {
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

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
					ctx.font = "12px monospace";
					ctx.fillText(p.text, p.x, p.y);
					if (filterText) {
						ctx.strokeStyle = "rgba(16, 185, 129, 0.1)";
						ctx.beginPath();
						ctx.moveTo(p.x, p.y);
						ctx.lineTo(canvas.width / 2, canvas.height / 2);
						ctx.stroke();
					}
				}
			});
			animationId = requestAnimationFrame(render);
		};
		render();
		return () => cancelAnimationFrame(animationId);
	}, []);

	return <canvas ref={canvasRef} className="fixed inset-0 z-0 bg-black" />;
};

export const Transmitter = () => {
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [loading, setLoading] = useState(false);

	const send = async (e) => {
		e.preventDefault();
		if (!msg) return;
		setLoading(true);
		try {
			await addDoc(collection(db, "thoughts"), {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
			});
			setMsg("");
			setCat("");
			setOpen(false);
		} catch (err) {
			console.error(err);
		}
		setLoading(false);
	};

	if (!open)
		return (
			<button
				onClick={() => setOpen(true)}
				className="fixed bottom-6 right-6 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform z-50 shadow-lg shadow-white/20"
			>
				<Plus size={24} />
			</button>
		);

	return (
		<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-6 relative shadow-2xl">
				<button
					onClick={() => setOpen(false)}
					className="absolute top-4 right-4 text-zinc-500 hover:text-white"
				>
					<X size={20} />
				</button>
				<h2 className="text-emerald-500 font-mono text-xs mb-6 tracking-widest">
					TRANSMITIR SEÑAL
				</h2>
				<form onSubmit={send} className="space-y-4">
					<input
						value={cat}
						onChange={(e) => setCat(e.target.value)}
						placeholder="Tema (ej: Política)..."
						className="w-full bg-transparent border-b border-zinc-700 p-2 text-zinc-300 text-sm outline-none focus:border-emerald-500"
						maxLength={20}
					/>
					<textarea
						value={msg}
						onChange={(e) => setMsg(e.target.value)}
						className="w-full bg-black/50 border border-zinc-700 p-3 text-white outline-none focus:border-emerald-500 h-24 resize-none font-serif text-lg"
						placeholder="Tu mensaje..."
						maxLength={140}
					/>
					<button
						disabled={loading}
						className="w-full bg-white text-black font-bold py-3 text-xs uppercase hover:bg-emerald-400 transition-colors"
					>
						{loading ? "ENVIANDO..." : "ENVIAR"}
					</button>
				</form>
			</div>
		</div>
	);
};
