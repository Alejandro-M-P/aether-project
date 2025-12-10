import React, { useEffect, useRef } from "react";
import { signInAnonymously } from "firebase/auth";
import {
	collection,
	onSnapshot,
	query,
	orderBy,
	limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { searchQuery } from "../store";

// --- UNIVERSE CANVAS ---
export const UniverseCanvas = () => {
	const canvasRef = useRef(null);
	const particlesRef = useRef([]);
	const starsRef = useRef([]);

	// 1. Conexión a Firebase y carga de datos
	useEffect(() => {
		signInAnonymously(auth).catch(() => {});

		// Inicializar estrellas de fondo
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
					const safeCategory = data.category
						? String(data.category).toUpperCase()
						: "GENERAL";

					valid.push({
						x: Math.random() * window.innerWidth,
						y: Math.random() * window.innerHeight,
						text: data.message,
						category: safeCategory,
						vx: (Math.random() - 0.5) * 0.3,
						vy: (Math.random() - 0.5) * 0.3,
					});
				}
			});
			particlesRef.current = valid;
		});
		return () => unsubscribe();
	}, []);

	// 2. Renderizado
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

			// Dibujar estrellas
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

			// Filtrado
			const filterText = searchQuery.get().toLowerCase().trim();

			particlesRef.current.forEach((p) => {
				p.x += p.vx;
				p.y += p.vy;

				if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
				if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

				// LÓGICA DE BÚSQUEDA (Invisible pero funcional)
				const matchMessage = p.text.toLowerCase().includes(filterText);
				const matchCategory = p.category.toLowerCase().includes(filterText);

				// Se muestra si coincide mensaje O categoría
				if (!filterText || matchMessage || matchCategory) {
					// Solo dibujamos el mensaje, la categoría está oculta
					ctx.font = "14px monospace";
					ctx.fillStyle = "#ffffff";
					ctx.globalAlpha = filterText ? 1 : 0.9;
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
		<canvas
			ref={canvasRef}
			className="fixed inset-0 w-full h-full bg-black -z-10"
		/>
	);
};

export default function Islands() {
	return null;
}
