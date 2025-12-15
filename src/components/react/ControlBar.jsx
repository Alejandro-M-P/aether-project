import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";

// Radio de aleatoriedad (~5-6km).
// Esto asegura que el punto caiga en la misma zona (Valencia) pero no en tu casa.
const RANDOM_RADIUS_DEGREE = 0.05;

const addRandomOffset = (location) => {
	const newLocation = { ...location };
	const angle = Math.random() * 2 * Math.PI;
	const distance = Math.random() * RANDOM_RADIUS_DEGREE;
	newLocation.lat += distance * Math.cos(angle);
	newLocation.lon += distance * Math.sin(angle);
	return newLocation;
};

const getPreciseLocation = () => {
	return new Promise((resolve) => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) =>
					resolve({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					}),
				(error) => {
					console.warn("Error geo:", error);
					resolve(null);
				},
				{ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
			);
		} else {
			resolve(null);
		}
	});
};

const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, { headers: { "Accept-Language": "es" } });
		const data = await response.json();
		const address = data.address;
		if (address) {
			const city =
				address.city || address.town || address.village || address.municipality;
			return { cityName: city || null, countryName: address.country || null };
		}
		return { cityName: null, countryName: null };
	} catch (error) {
		return { cityName: null, countryName: null };
	}
};

export default function ControlBar() {
	const $searchQuery = useStore(searchQuery);
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");
	const [isSending, setIsSending] = useState(false);

	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;

		const user = auth.currentUser;
		setIsSending(true);

		let preciseLocation = await getPreciseLocation();
		let randomizedLocation = null;
		let geoNames = { cityName: null, countryName: null };

		if (preciseLocation) {
			// 1. OBTENER NOMBRE REAL DE LA CIUDAD (Antes de aleatorizar)
			// Así sale "Valencia" aunque el punto aleatorio caiga en un campo de las afueras.
			geoNames = await reverseGeocode(preciseLocation.lat, preciseLocation.lon);

			// 2. ALEATORIZAR COORDENADAS
			// Movemos el punto unos km para proteger la privacidad
			randomizedLocation = addRandomOffset(preciseLocation);
		}

		try {
			const thoughtData = {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
				uid: user ? user.uid : "anonymous",
				photoURL: user ? user.photoURL : null,
				displayName: user ? user.displayName : "Anónimo",
			};

			if (randomizedLocation) {
				thoughtData.location = randomizedLocation; // Guardamos la coord falsa
				thoughtData.cityName = geoNames.cityName; // Guardamos la ciudad real
				thoughtData.countryName = geoNames.countryName;
			}

			await addDoc(collection(db, "thoughts"), thoughtData);
			setMsg("");
			setCat("");
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
			alert("Error enviando. Inténtalo de nuevo.");
		} finally {
			setIsSending(false);
		}
	};

	return (
		<>
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-2 md:px-4 py-4 md:py-8 pointer-events-none flex justify-center">
				<div className="pointer-events-auto flex items-center bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all w-[98%] max-w-lg group">
					<div className="flex items-center gap-2 md:gap-3 w-1/2 pl-4 pr-2 py-2 border-r border-zinc-700/50">
						<Search className="h-3 w-3 md:h-4 md:w-4 text-white/40 group-hover:text-cyan-400 transition-colors" />
						<input
							type="text"
							value={$searchQuery}
							onChange={(e) => searchQuery.set(e.target.value)}
							className="w-full bg-transparent border-none text-white/90 text-xs md:text-sm font-mono placeholder-white/30 focus:outline-none h-full"
							placeholder="Buscar..."
						/>
					</div>
					<button
						onClick={() => setOpen(true)}
						className="w-1/2 flex items-center justify-center gap-2 md:gap-3 bg-transparent hover:bg-zinc-800/80 text-emerald-400 hover:text-white text-[10px] md:text-base font-mono uppercase tracking-widest px-4 py-3 md:px-6 md:py-4 rounded-r-full transition-all active:scale-[0.99] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
					>
						<span className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
						TRANSMITIR
					</button>
				</div>
			</footer>

			{open && (
				<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
					<div className="w-full max-w-lg relative animate-in fade-in zoom-in duration-300 my-auto">
						<button
							onClick={() => setOpen(false)}
							className="absolute top-3 right-4 md:-top-12 md:right-0 text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest cursor-pointer hover:drop-shadow-[0_0_5px_rgba(6,182,212,1)] z-10"
						>
							<span className="hidden md:inline">[ Cerrar ]</span>{" "}
							<X size={20} />
						</button>

						<div className="bg-zinc-950/95 border border-cyan-500/20 rounded-2xl p-6 md:p-8 shadow-[0_0_80px_rgba(6,182,212,0.2)] ring-2 ring-white/5 backdrop-blur-md">
							<div className="text-center mb-6 md:mb-8 mt-2 md:mt-0">
								<h2 className="text-white font-mono text-xs md:text-sm tracking-[0.3em] uppercase opacity-70">
									Nueva Transmisión
								</h2>
							</div>
							<form onSubmit={send} className="flex flex-col gap-4 md:gap-6">
								<input
									value={cat}
									onChange={(e) => setCat(e.target.value)}
									placeholder="CANAL / CATEGORÍA"
									className="bg-transparent border-b border-white/10 py-2 text-white/60 text-[10px] md:text-xs font-mono tracking-0.1em text-center uppercase focus:outline-none focus:border-emerald-500/50 transition-colors"
								/>
								<textarea
									value={msg}
									onChange={(e) => setMsg(e.target.value)}
									className="bg-transparent text-white text-base md:text-lg font-light text-center resize-none placeholder-white/20 focus:outline-none h-24 md:h-32 leading-relaxed"
									placeholder="Escribe tu mensaje..."
									maxLength={280}
									autoFocus
								/>
								<button
									disabled={isSending}
									className="w-full bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-500/20 text-emerald-400 hover:text-white py-3 md:py-4 rounded-lg text-[10px] md:text-xs font-mono tracking-[0.2em] uppercase transition-all disabled:opacity-50 mt-2 group cursor-pointer hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
								>
									{isSending ? (
										<span className="animate-pulse">Enviando...</span>
									) : (
										<span>Enviar Señal</span>
									)}
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
