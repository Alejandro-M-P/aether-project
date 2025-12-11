import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { db, auth } from "../../firebase.js";
import { useStore } from "@nanostores/react";
import { searchQuery } from "../../store.js";

// CONSTANTE para la privacidad: ~0.05 grados equivale a ~5.5 km cerca del ecuador
const RANDOM_RADIUS_DEGREE = 0.05;

// AÑADIDO: Offset Aleatorio (5-6km)
const addRandomOffset = (location) => {
	// 🚨 Aseguramos que la función modifique la copia
	const newLocation = { ...location };

	// Generar un ángulo y una distancia aleatorios
	const angle = Math.random() * 2 * Math.PI;
	const distance = Math.random() * RANDOM_RADIUS_DEGREE;

	// Fórmula para añadir un offset (aproximado)
	newLocation.lat += distance * Math.cos(angle);
	newLocation.lon += distance * Math.sin(angle);

	return newLocation;
};

// FUNCIÓN AUXILIAR: Obtiene la ubicación precisa (lat/lon)
const getPreciseLocation = () => {
	return new Promise((resolve) => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						lat: position.coords.latitude,
						lon: position.coords.longitude,
					});
				},
				(error) => {
					console.warn("Error de geolocalización precisa:", error);
					resolve(null);
				},
				{ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
			);
		} else {
			resolve(null); // Navegador no soporta geolocalización
		}
	});
};

// FUNCIÓN AUXILIAR: Convierte coordenadas a ciudad/país (Nominatim - OpenStreetMap)
const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, { headers: { "Accept-Language": "es" } });
		const data = await response.json();

		const address = data.address;
		if (address) {
			// Prioridad: Ciudad, Pueblo, etc.
			const city =
				address.city || address.town || address.village || address.municipality;
			const country = address.country;

			return {
				cityName: city || null,
				countryName: country || null,
			};
		}

		return { cityName: null, countryName: null };
	} catch (error) {
		console.error("Error en Reverse Geocoding:", error);
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
		if (!user) {
			alert("Debes conectarte (botón arriba derecha) para transmitir.");
			return;
		}

		setIsSending(true);

		// 1. OBTENER LA UBICACIÓN PRECISA
		let preciseLocation = await getPreciseLocation();

		let randomizedLocation = null;
		let geoNames = { cityName: null, countryName: null };

		if (preciseLocation) {
			// 2. AÑADIR EL OFFSET ALEATORIO para anonimizar la posición
			randomizedLocation = addRandomOffset(preciseLocation);

			// 3. CONVERTIR A NOMBRE DE UBICACIÓN usando la ubicación RANDOMIZADA
			geoNames = await reverseGeocode(
				randomizedLocation.lat,
				randomizedLocation.lon
			);
		}

		try {
			// 4. PREPARAR DATOS
			const thoughtData = {
				message: msg,
				category: cat || "general",
				timestamp: serverTimestamp(),
				uid: user.uid,
				photoURL: user.photoURL,
				displayName: user.displayName,
			};

			if (randomizedLocation) {
				thoughtData.location = randomizedLocation; // Coordenadas aleatorias (para mapa/proximidad)
				thoughtData.cityName = geoNames.cityName; // Nombre de la ciudad (randomizada)
				thoughtData.countryName = geoNames.countryName; // Nombre del país (randomizada)
			}

			await addDoc(collection(db, "thoughts"), thoughtData);

			setMsg("");
			setCat("");
			setOpen(false);
		} catch (error) {
			console.error("Error enviando:", error);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<>
			{/* FOOTER - Z-INDEX 50 para asegurar que esté encima */}
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 py-8 pointer-events-none flex justify-center">
				<div className="pointer-events-auto flex items-center bg-zinc-900 backdrop-blur-xl border border-zinc-800 rounded-full shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all w-full max-w-lg group">
					
					{/* BARRA DE BÚSQUEDA (50%) */}
					<div className="flex items-center gap-3 w-1/2 pl-4 pr-3 py-2 border-r border-zinc-700/50">
						<Search className="h-4 w-4 text-white/40 group-hover:text-cyan-400 transition-colors" />
						<input
							type="text"
							value={$searchQuery}
							onChange={(e) => searchQuery.set(e.target.value)}
							className="w-full bg-transparent border-none text-white/90 text-sm font-mono placeholder-white/30 focus:outline-none h-full"
							placeholder="Buscar frecuencia..."
						/>
					</div>

					{/* BOTÓN TRANSMITIR (50%) */}
					<button
						onClick={() => setOpen(true)}
						className="w-1/2 flex items-center justify-center gap-3 bg-transparent hover:bg-zinc-800/80 text-emerald-400 hover:text-white text-base font-mono uppercase tracking-widest px-6 py-4 rounded-r-full transition-all active:scale-[0.99] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
					>
                        <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
						TRANSMITIR SEÑAL
					</button>
				</div>
			</footer>

			{/* MODAL - Z-INDEX 60 para estar encima de todo */}
			{open && (
				<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-6">
					<div className="w-full max-w-lg relative animate-in fade-in zoom-in duration-300">
						<button
							onClick={() => setOpen(false)}
							className="absolute -top-12 right-0 text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest cursor-pointer hover:drop-shadow-[0_0_5px_rgba(6,182,212,1)]"
						>
							[ Cerrar ] <X size={20} />
						</button>

						<div className="bg-zinc-950/95 border border-cyan-500/20 rounded-2xl p-8 shadow-[0_0_80px_rgba(6,182,212,0.2)] ring-2 ring-white/5 backdrop-blur-md">
							<div className="text-center mb-8">
								<h2 className="text-white font-mono text-sm tracking-[0.3em] uppercase opacity-70">
									Nueva Transmisión
								</h2>
							</div>

							<form onSubmit={send} className="flex flex-col gap-6">
								<input
									value={cat}
									onChange={(e) => setCat(e.target.value)}
									placeholder="CANAL / CATEGORÍA"
									className="bg-transparent border-b border-white/10 py-2 text-white/60 text-xs font-mono tracking-0.1em text-center uppercase focus:outline-none focus:border-emerald-500/50 transition-colors"
								/>
								<textarea
									value={msg}
									onChange={(e) => setMsg(e.target.value)}
									className="bg-transparent text-white text-lg font-light text-center resize-none placeholder-white/20 focus:outline-none h-32 leading-relaxed"
									placeholder="Escribe tu mensaje al vacío..."
									maxLength={280}
									autoFocus
								/>
								<button
									disabled={isSending}
									className="w-full bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-500/20 text-emerald-400 hover:text-white py-4 rounded-lg text-xs font-mono tracking-[0.2em] uppercase transition-all disabled:opacity-50 mt-2 group cursor-pointer hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]"
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