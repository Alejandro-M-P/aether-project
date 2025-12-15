import React, { useState, useEffect } from "react";
import { Search, X, MapPin } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";

const RANDOM_RADIUS_DEGREE = 0.01;

const addRandomOffset = (location) => {
	const newLocation = { ...location };
	const angle = Math.random() * 2 * Math.PI;
	const distance = Math.random() * RANDOM_RADIUS_DEGREE;
	newLocation.lat += distance * Math.cos(angle);
	newLocation.lon += distance * Math.sin(angle);
	return newLocation;
};

// 1. Obtener GPS
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
					console.warn("GPS error:", error);
					resolve(null);
				},
				{ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
			);
		} else {
			resolve(null);
		}
	});
};

// 2. Coordenadas -> Nombre (Para cuando dejas el campo vacío)
const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, {
			headers: { "Accept-Language": "es", "User-Agent": "AetherApp/1.0" },
		});
		const data = await response.json();
		return data.address
			? data.address.city ||
					data.address.town ||
					data.address.municipality ||
					data.address.county ||
					""
			: "";
	} catch (error) {
		return "";
	}
};

// 3. Nombre -> Coordenadas (Para cuando escribes manual)
const getCoordsFromCityName = async (cityName) => {
	try {
		const url = `https://nominatim.openstreetmap.org/search?format=json&q=${cityName}&limit=1`;
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
	const [open, setOpen] = useState(false);
	const [msg, setMsg] = useState("");
	const [cat, setCat] = useState("");

	// Estados Ubicación
	const [manualCity, setManualCity] = useState("");
	const [autoLocation, setAutoLocation] = useState(null);
	const [isLocating, setIsLocating] = useState(false);
	const [isSending, setIsSending] = useState(false);

	useEffect(() => {
		if (open) {
			setIsLocating(true);
			setManualCity(""); // Empezamos limpio
			(async () => {
				const loc = await getPreciseLocation();
				if (loc) {
					setAutoLocation(loc);
					const name = await reverseGeocode(loc.lat, loc.lon);
					// Solo lo rellenamos visualmente para que sepas dónde estás
					setManualCity(name || "");
				}
				setIsLocating(false);
			})();
		}
	}, [open]);

	const send = async (e) => {
		e.preventDefault();
		if (!msg.trim() || isSending) return;

		const user = auth.currentUser;
		setIsSending(true);

		try {
			let finalCoords = null;
			let finalCityName = manualCity.trim();

			// CASO 1: Escribiste algo (ej: "Madrid")
			if (finalCityName) {
				// Intentamos buscar coordenadas de ese nombre
				const coordsFromName = await getCoordsFromCityName(finalCityName);
				if (coordsFromName) {
					finalCoords = coordsFromName;
				} else if (autoLocation) {
					// Si escribiste algo raro que no existe, usamos tu GPS real como respaldo
					finalCoords = autoLocation;
				}
			}
			// CASO 2: NO escribiste nada (Campo vacío)
			else {
				if (autoLocation) {
					finalCoords = autoLocation;
					// IMPORTANTE: Si está vacío, buscamos el nombre real para no guardar "null"
					const autoName = await reverseGeocode(
						autoLocation.lat,
						autoLocation.lon
					);
					finalCityName = autoName || "Localizado";
				} else {
					// Si no escribiste nada Y no hay GPS -> ERROR
					alert(
						"⚠️ No sé dónde ponerte en el mapa.\n\nPor favor, escribe el nombre de tu ciudad."
					);
					setIsSending(false);
					return;
				}
			}

			// Aplicar el desplazamiento aleatorio de 1km
			const randomizedLocation = finalCoords
				? addRandomOffset(finalCoords)
				: null;

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
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
			alert("Error enviando mensaje.");
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
								<div className="flex gap-4">
									<input
										value={cat}
										onChange={(e) => setCat(e.target.value)}
										placeholder="CANAL"
										className="w-1/2 bg-transparent border-b border-white/10 py-2 text-white/60 text-[10px] md:text-xs font-mono tracking-widest uppercase focus:outline-none focus:border-emerald-500/50 text-center"
									/>
									<div className="w-1/2 relative">
										<MapPin className="absolute left-0 top-2 w-3 h-3 text-white/30" />
										<input
											value={manualCity}
											onChange={(e) => setManualCity(e.target.value)}
											placeholder={isLocating ? "..." : "CIUDAD (Vacío = Auto)"}
											className={`w-full bg-transparent border-b border-white/10 py-2 pl-5 text-[10px] md:text-xs font-mono tracking-widest uppercase focus:outline-none focus:border-emerald-500/50 text-center ${
												isLocating
													? "animate-pulse text-emerald-500"
													: "text-emerald-400"
											}`}
										/>
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
