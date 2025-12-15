import React, { useState, useEffect } from "react";
import { Filter, X, MapPin, ChevronUp, Check, Globe } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import {
	searchQuery,
	availableCategories,
	isPickingLocation,
	pickedCoordinates,
} from "../../store.js";

const RANDOM_RADIUS_DEGREE = 0.01;

const addRandomOffset = (location) => {
	const newLocation = { ...location };
	const angle = Math.random() * 2 * Math.PI;
	const distance = Math.random() * RANDOM_RADIUS_DEGREE;
	newLocation.lat += distance * Math.cos(angle);
	newLocation.lon += distance * Math.sin(angle);
	return newLocation;
};

// --- LÓGICA DE NOMBRES MEJORADA (PRIORIDAD ISLAS) ---
const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, {
			headers: { "Accept-Language": "es", "User-Agent": "AetherApp/1.0" },
		});
		const data = await response.json();
		const addr = data.address;

		if (addr) {
			// 1. El lugar concreto
			const specific =
				addr.city ||
				addr.town ||
				addr.village ||
				addr.hamlet ||
				addr.municipality;

			// 2. El contexto (Isla mata a todo lo demás)
			// A veces Nominatim devuelve la isla en 'island', 'archipelago' o incluso 'region'
			let context = addr.island || addr.archipelago;

			// Si NO es isla, usamos el país (ej: España)
			if (!context) {
				context = addr.country;
			}

			// 3. Formato Final
			if (specific && context) {
				return `${specific} (${context})`; // Ej: "Palma (Mallorca)" o "Valencia (España)"
			}
			// Fallbacks
			if (specific) return specific;
			if (context) return context;

			return "Ubicación Marcada";
		}
		return "Ubicación Marcada";
	} catch (error) {
		return "Ubicación Marcada";
	}
};

const getCoordsFromCityName = async (cityName) => {
	try {
		// Limpiamos paréntesis para que la búsqueda no se líe
		const cleanName = cityName.replace(/[()]/g, "");
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${cleanName}&limit=1`;
		const response = await fetch(url, {
			headers: { "User-Agent": "AetherApp/1.0" },
		});
		const data = await response.json();
		if (data && data.length > 0) {
			return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
		}
		return null;
	} catch (error) {
		return null;
	}
};

export default function ControlBar() {
	const $searchQuery = useStore(searchQuery);
	const $availableCategories = useStore(availableCategories);
	const $isPicking = useStore(isPickingLocation);
	const $pickedCoordinates = useStore(pickedCoordinates);

	const [open, setOpen] = useState(false);
	const [isCatMenuOpen, setIsCatMenuOpen] = useState(false);

	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");

	const [manualCity, setManualCity] = useState("");
	const [selectedExactLocation, setSelectedExactLocation] = useState(null);
	const [isSending, setIsSending] = useState(false);

	useEffect(() => {
		if ($pickedCoordinates) {
			setOpen(true);
			setSelectedExactLocation($pickedCoordinates);
			setManualCity("Identificando...");

			reverseGeocode($pickedCoordinates.lat, $pickedCoordinates.lng).then(
				(name) => {
					setManualCity(name);
				}
			);

			pickedCoordinates.set(null);
		}
	}, [$pickedCoordinates]);

	useEffect(() => {
		const closeMenu = () => setIsCatMenuOpen(false);
		if (isCatMenuOpen) window.addEventListener("click", closeMenu);
		return () => window.removeEventListener("click", closeMenu);
	}, [isCatMenuOpen]);

	const handlePickLocation = () => {
		setOpen(false);
		isPickingLocation.set(true);
	};

	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;

		const user = auth.currentUser;
		setIsSending(true);

		try {
			let finalCoords = null;
			let finalCityName = manualCity.trim();

			if (selectedExactLocation) {
				finalCoords = selectedExactLocation;
			} else if (finalCityName) {
				const coordsFromName = await getCoordsFromCityName(finalCityName);
				if (coordsFromName) {
					finalCoords = coordsFromName;
				} else {
					alert(`❌ No encuentro "${finalCityName}". Usa el mapa 🌍.`);
					setIsSending(false);
					return;
				}
			} else {
				const getGPS = () =>
					new Promise((resolve) => {
						if (!navigator.geolocation) resolve(null);
						navigator.geolocation.getCurrentPosition(
							(p) =>
								resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
							() => resolve(null),
							{ timeout: 4000 }
						);
					});

				const gps = await getGPS();
				if (gps) {
					finalCoords = gps;
					const autoName = await reverseGeocode(gps.lat, gps.lon);
					finalCityName = autoName || "Localizado";
				} else {
					alert("⚠️ No detecto GPS. Selecciona en el mapa.");
					setIsSending(false);
					return;
				}
			}

			if (!finalCityName || finalCityName === "undefined")
				finalCityName = "Localizado";

			const randomizedLocation = addRandomOffset(finalCoords);

			const thoughtData = {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
				uid: user ? user.uid : "anonymous",
				photoURL: user ? user.photoURL : null,
				displayName: user ? user.displayName : "Anónimo",
				cityName: finalCityName,
				location: randomizedLocation,
			};

			await addDoc(collection(db, "thoughts"), thoughtData);
			setMsg("");
			setCat("");
			setManualCity("");
			setSelectedExactLocation(null);
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
			alert("Error enviando.");
		} finally {
			setIsSending(false);
		}
	};

	if ($isPicking) {
		return (
			<div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
				<div className="bg-black/80 backdrop-blur-md border border-cyan-500/50 text-cyan-400 px-6 py-3 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.3)] pointer-events-auto animate-pulse flex items-center gap-3">
					<Globe className="w-5 h-5 animate-spin-slow" />
					<span className="font-mono text-sm tracking-widest uppercase">
						Haz clic en el mapa...
					</span>
					<button
						onClick={() => {
							isPickingLocation.set(false);
							setOpen(true);
						}}
						className="ml-2 hover:text-white transition-colors"
					>
						<X size={16} />
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-2 md:px-4 py-4 md:py-8 pointer-events-none flex justify-center">
				<div className="pointer-events-auto flex items-center bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all w-[98%] max-w-lg group relative">
					<div
						className="flex items-center gap-3 w-1/2 pl-6 pr-4 py-4 border-r border-zinc-700/50 cursor-pointer hover:bg-white/5 transition-colors rounded-l-full relative"
						onClick={(e) => {
							e.stopPropagation();
							setIsCatMenuOpen(!isCatMenuOpen);
						}}
					>
						<Filter
							className={`h-4 w-4 ${
								$searchQuery ? "text-cyan-400" : "text-zinc-500"
							} transition-colors`}
						/>
						<div className="flex-1 min-w-0">
							<span
								className={`block text-xs font-mono tracking-widest uppercase truncate ${
									$searchQuery ? "text-white" : "text-zinc-500"
								}`}
							>
								{$searchQuery || "CATEGORÍAS"}
							</span>
						</div>
						<ChevronUp
							className={`w-3 h-3 text-zinc-600 transition-transform duration-300 ${
								isCatMenuOpen ? "rotate-180" : ""
							}`}
						/>

						{isCatMenuOpen && (
							<div className="absolute bottom-[130%] left-0 w-full bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
								<div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
									<button
										onClick={() => searchQuery.set("")}
										className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-lg flex items-center justify-between group transition-colors"
									>
										<span className="text-xs font-mono text-zinc-400 group-hover:text-white uppercase tracking-wider">
											Todas
										</span>
										{!$searchQuery && (
											<Check className="w-3 h-3 text-cyan-400" />
										)}
									</button>
									{$availableCategories.map((c) => (
										<button
											key={c}
											onClick={() => searchQuery.set(c.toLowerCase())}
											className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-lg flex items-center justify-between group transition-colors"
										>
											<span className="text-xs font-mono text-zinc-300 group-hover:text-cyan-400 uppercase tracking-wider">
												{c}
											</span>
											{$searchQuery.toUpperCase() === c.toUpperCase() && (
												<Check className="w-3 h-3 text-cyan-400" />
											)}
										</button>
									))}
								</div>
							</div>
						)}
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
								<div className="flex gap-4">
									<input
										value={cat}
										onChange={(e) => setCat(e.target.value)}
										placeholder="CANAL"
										className="w-1/3 bg-transparent border-b border-white/10 py-2 text-white/60 text-[10px] md:text-xs font-mono tracking-widest uppercase focus:outline-none focus:border-emerald-500/50 text-center"
									/>

									<div className="w-2/3 relative flex items-center">
										<MapPin className="absolute left-0 w-3 h-3 text-white/30" />
										<input
											value={manualCity}
											onChange={(e) => {
												setManualCity(e.target.value);
												setSelectedExactLocation(null);
											}}
											placeholder="UBICACIÓN (Vacío = GPS)"
											className="w-full bg-transparent border-b border-white/10 py-2 pl-5 pr-6 text-[10px] md:text-xs font-mono tracking-widest uppercase focus:outline-none focus:border-emerald-500/50 text-center text-emerald-400 placeholder-white/20"
										/>
										<button
											type="button"
											onClick={handlePickLocation}
											className="absolute right-0 p-1 text-zinc-500 hover:text-cyan-400 transition-colors"
											title="Seleccionar en mapa"
										>
											<Globe size={14} />
										</button>
									</div>
								</div>
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
