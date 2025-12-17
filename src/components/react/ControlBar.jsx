// File: src/components/react/ControlBar.jsx

import React, { useState, useEffect } from "react";
import {
	Filter,
	X,
	MapPin,
	ChevronUp,
	ChevronDown,
	Check,
	Globe,
	Plus,
	Search,
} from "lucide-react";
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

// --- REVERSE GEOCODING ---
const reverseGeocode = async (lat, lon) => {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
		const response = await fetch(url, {
			headers: { "Accept-Language": "es", "User-Agent": "AetherApp/1.0" },
		});
		const data = await response.json();
		const addr = data.address;

		if (addr) {
			const specific =
				addr.city ||
				addr.town ||
				addr.village ||
				addr.hamlet ||
				addr.municipality;

			let context =
				addr.island || addr.archipelago || addr.state || addr.region;

			if (!context) {
				context = addr.country;
			}

			if (specific && context) {
				return `${specific} (${context})`;
			}
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

	// Estado para sugerencias
	const [showCatSuggestions, setShowCatSuggestions] = useState(false);
	const [filteredCats, setFilteredCats] = useState([]);

	const [manualCity, setManualCity] = useState("");

	const [selectedExactLocation, setSelectedExactLocation] = useState(null);

	const [isSending, setIsSending] = useState(false);

	// Bandera para saber si la categoría que está escribiendo el usuario ya existe
	const catExists = $availableCategories
		.map((c) => c.toUpperCase())
		.includes(cat.trim().toUpperCase());

	// Filtrado inteligente
	useEffect(() => {
		if (!cat.trim()) {
			setFilteredCats($availableCategories);
		} else {
			const lower = cat.toLowerCase();
			setFilteredCats(
				$availableCategories.filter((c) => c.toLowerCase().includes(lower))
			);
		}
	}, [cat, $availableCategories]);

	useEffect(() => {
		if ($pickedCoordinates) {
			setOpen(true);
			const normalizedCoords = {
				lat: $pickedCoordinates.lat,
				lon: $pickedCoordinates.lng,
			};
			setSelectedExactLocation(normalizedCoords);
			setManualCity("Identificando...");
			reverseGeocode(normalizedCoords.lat, normalizedCoords.lon).then(
				(name) => {
					setManualCity(name);
				}
			);
			pickedCoordinates.set(null);
		}
	}, [$pickedCoordinates]);

	// Gestión de apertura/cierre del menú de categorías del footer
	const handleToggleCatMenu = (e) => {
		e.stopPropagation();
		setIsCatMenuOpen((prev) => !prev);
	};

	// Cierra el menú de categorías del footer al hacer clic fuera
	useEffect(() => {
		const closeMenu = (e) => {
			if (e.target.closest(".category-menu-container")) {
				return;
			}
			setIsCatMenuOpen(false);
		};
		if (isCatMenuOpen) document.addEventListener("click", closeMenu);
		return () => document.removeEventListener("click", closeMenu);
	}, [isCatMenuOpen]);

	const handlePickLocation = () => {
		setOpen(false);
		isPickingLocation.set(true);
	};

	// Función para manejar la selección de una categoría existente desde el desplegable
	const handleSelectExistingCat = (selectedCat) => {
		setCat(selectedCat);
		setShowCatSuggestions(false);
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
			const cleanCat = cat ? cat.trim().toUpperCase() : "GENERAL";

			// Datos que van a Firebase
			const thoughtData = {
				message: msg,
				category: cleanCat,
				timestamp: serverTimestamp(),
				uid: user ? user.uid : "anonymous",
				photoURL: user ? user.photoURL : null,
				displayName: user ? user.displayName : "Anónimo",
				cityName: finalCityName,
				location: randomizedLocation,
				// Campo vacío que n8n rellenará después con el "ECO"
				systemEcho: null,
			};

			// 1. Guardamos en Firebase primero para obtener el ID
			const docRef = await addDoc(collection(db, "thoughts"), thoughtData);

			// 2. Disparamos "ECHO" (siempre, sin pedir permiso)
			try {
				// ⚠️ TU URL DE N8N (No olvides cambiarla si cambia)
				const N8N_WEBHOOK_URL =
					"http://localhost:5678/webhook-test/df3af043-d601-4b6e-816a-9d2b0656136e";

				fetch(N8N_WEBHOOK_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						id: docRef.id, // ID para editar luego
						mensaje: msg, // Lo que dijo el usuario
						coords: randomizedLocation, // Dónde está
						usuario: user ? user.displayName : "Anónimo",
					}),
				}).catch((e) => console.log("Echo silencioso:", e));
			} catch (n8nError) {
				console.error("Error trigger n8n:", n8nError);
			}

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
			{/* --- FOOTER --- */}
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 md:px-8 py-4 md:py-8 pointer-events-none flex justify-center gap-4 items-center">
				<div className="category-menu-container pointer-events-auto relative w-40 md:w-52">
					<button
						className="w-full flex items-center justify-center gap-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 cursor-pointer hover:bg-zinc-800/80 transition-colors rounded-full relative shadow-[0_0_20px_rgba(0,0,0,0.5)] px-5 py-3.5 md:px-6 md:py-4"
						onClick={handleToggleCatMenu}
					>
						<Search
							className={`h-4 w-4 ${
								$searchQuery ? "text-cyan-400" : "text-zinc-500"
							} transition-colors`}
						/>
						<div className="min-w-0 text-left">
							<span
								className={`block text-[10px] md:text-xs font-mono tracking-widest uppercase truncate ${
									$searchQuery ? "text-white" : "text-zinc-500"
								}`}
							>
								{$searchQuery || "Buscar Canales"}
							</span>
						</div>
						<ChevronUp
							className={`w-3 h-3 text-zinc-600 transition-transform duration-300 ${
								isCatMenuOpen ? "rotate-180" : ""
							}`}
						/>
					</button>

					{isCatMenuOpen && (
						<div className="absolute bottom-[130%] left-0 w-full min-w-[200px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-lg overflow-hidden shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
							<div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
								<button
									onClick={(e) => {
										e.stopPropagation();
										searchQuery.set("");
										setIsCatMenuOpen(false);
									}}
									className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-full flex items-center justify-between group transition-colors"
								>
									<span className="text-xs font-mono text-zinc-400 group-hover:text-white uppercase tracking-wider">
										Todas las Categorías
									</span>
									{!$searchQuery && <Check className="w-3 h-3 text-cyan-400" />}
								</button>
								{$availableCategories.map((c) => (
									<button
										key={c}
										onClick={(e) => {
											e.stopPropagation();
											searchQuery.set(c.toLowerCase());
											setIsCatMenuOpen(false);
										}}
										className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-full flex items-center justify-between group transition-colors"
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

				<div className="pointer-events-auto w-40 md:w-52">
					<button
						onClick={() => setOpen(true)}
						className="w-full flex items-center justify-center gap-2 md:gap-3 bg-emerald-700/50 backdrop-blur-xl border border-emerald-500/50 text-emerald-300 hover:text-white text-[10px] md:text-base font-mono uppercase tracking-widest px-5 py-3.5 md:px-6 md:py-4 rounded-full transition-all active:scale-[0.99] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]"
					>
						<Plus size={16} className="text-emerald-500" />
						Crear Señal
					</button>
				</div>
			</footer>

			{/* --- MODAL --- */}
			{open && (
				<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-4 md:p-6 overflow-y-auto">
					<div className="w-full max-w-lg relative animate-in fade-in zoom-in duration-300 my-auto">
						<button
							onClick={() => setOpen(false)}
							className="absolute top-3 right-4 md:-top-12 md:-right-4 text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-2 text-xs font-mono uppercase tracking-widest cursor-pointer hover:drop-shadow-[0_0_5px_rgba(6,182,212,1)] z-10"
						>
							<span className="hidden md:inline">[ Cerrar ]</span>{" "}
							<X size={20} />
						</button>

						<div className="bg-zinc-950/95 border border-cyan-500/20 rounded-xl p-6 md:p-8 shadow-[0_0_80px_rgba(6,182,212,0.2)] ring-2 ring-white/5 backdrop-blur-md">
							<div className="text-center mb-6 md:mb-8 mt-2 md:mt-0">
								<h2 className="text-white font-mono text-xs md:text-sm tracking-[0.3em] uppercase opacity-70">
									Nueva Transmisión
								</h2>
							</div>

							<form onSubmit={send} className="flex flex-col gap-6 md:gap-8">
								<div className="flex gap-4">
									<div className="w-1/2 relative z-50">
										<label className="block text-[10px] text-zinc-400 font-mono tracking-widest mb-1">
											CANAL
										</label>
										<div className="relative border border-cyan-700/50 rounded-full shadow-inner shadow-black/50 bg-zinc-900/50">
											<input
												value={cat}
												onChange={(e) => setCat(e.target.value)}
												onFocus={() => setShowCatSuggestions(true)}
												onBlur={() =>
													setTimeout(() => setShowCatSuggestions(false), 200)
												}
												className="w-full bg-transparent py-3 pl-4 pr-8 text-white text-sm font-mono tracking-wide focus:outline-none placeholder-white/30"
												autoComplete="off"
											/>
											<ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
										</div>
										{showCatSuggestions && (
											<div className="absolute top-[calc(100%+5px)] left-0 w-full mt-1 rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden bg-zinc-950 border border-cyan-500/30 max-h-[12rem]">
												<div className="flex flex-col overflow-y-auto custom-scrollbar">
													{filteredCats.map((existingCat) => (
														<div
															key={existingCat}
															onMouseDown={(e) => {
																e.preventDefault();
																handleSelectExistingCat(existingCat);
															}}
															className="px-3 py-3.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-cyan-400 cursor-pointer font-mono uppercase truncate text-center transition-colors border-b border-zinc-900 last:border-b-0 flex items-center justify-center gap-2 rounded-full mx-1 my-0.5"
														>
															<Search size={12} />
															{existingCat}
														</div>
													))}
												</div>
											</div>
										)}
									</div>
									<div className="w-1/2 flex items-start pt-[1.7rem] relative">
										<button
											type="button"
											className={`w-full py-3 rounded-full text-white font-mono uppercase text-center transition-all flex items-center justify-center gap-2 text-xs font-bold shadow-xl z-40 relative group ${
												cat.trim() && !catExists
													? "bg-emerald-700/50 hover:bg-emerald-600/70 border border-emerald-500/50"
													: "bg-zinc-800/50 border border-zinc-700/50 text-zinc-500 cursor-default"
											}`}
											disabled={!cat.trim() || catExists}
										>
											<Plus size={16} />{" "}
											{cat.trim()
												? `CREAR: "${cat.toUpperCase()}"`
												: "CREAR CANAL"}
										</button>
									</div>
								</div>

								<div className="relative z-0 border border-cyan-700/50 rounded-full shadow-inner shadow-black/50 bg-zinc-900/50 px-4 py-3 flex items-center">
									<MapPin className="w-5 h-5 text-cyan-400 mr-3" />
									<input
										value={manualCity}
										onChange={(e) => {
											setManualCity(e.target.value);
											setSelectedExactLocation(null);
										}}
										placeholder="UBICACIÓN (Vacío = GPS)"
										className="w-full bg-transparent text-white text-sm font-mono tracking-wide focus:outline-none placeholder-white/30"
									/>
									<button
										type="button"
										onClick={handlePickLocation}
										className="p-1 text-cyan-400 hover:text-white transition-colors ml-2"
									>
										<Globe size={20} />
									</button>
								</div>

								<textarea
									value={msg}
									onChange={(e) => setMsg(e.target.value)}
									className="bg-zinc-900/50 border border-zinc-700/50 text-white text-base md:text-lg font-light text-center resize-none placeholder-white/20 focus:outline-none focus:border-cyan-500/50 rounded-full h-24 md:h-32 leading-relaxed p-4 transition-colors"
									placeholder="Escribe tu mensaje..."
									maxLength={4000}
								/>

								<button
									disabled={isSending || !msg.trim()}
									className="w-full bg-emerald-900/20 hover:bg-emerald-800/50 border border-emerald-500/20 text-emerald-400 hover:text-white py-3 rounded-full text-xs font-mono tracking-[0.2em] uppercase transition-all disabled:opacity-50 mt-2 group cursor-pointer hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] disabled:cursor-not-allowed"
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
