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
			if (!context) context = addr.country;
			if (specific && context) return `${specific} (${context})`;
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
	const [showCatSuggestions, setShowCatSuggestions] = useState(false);
	const [filteredCats, setFilteredCats] = useState([]);
	const [manualCity, setManualCity] = useState("");
	const [selectedExactLocation, setSelectedExactLocation] = useState(null);
	const [isSending, setIsSending] = useState(false);

	const catExists = $availableCategories
		.map((c) => c.toUpperCase())
		.includes(cat.trim().toUpperCase());

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

	const handleToggleCatMenu = (e) => {
		e.stopPropagation();
		setIsCatMenuOpen((prev) => !prev);
	};

	useEffect(() => {
		const closeMenu = (e) => {
			if (!e.target.closest(".category-menu-container"))
				setIsCatMenuOpen(false);
		};
		if (isCatMenuOpen) document.addEventListener("click", closeMenu);
		return () => document.removeEventListener("click", closeMenu);
	}, [isCatMenuOpen]);

	const handlePickLocation = () => {
		setOpen(false);
		isPickingLocation.set(true);
	};

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
				if (coordsFromName) finalCoords = coordsFromName;
				else {
					alert(`❌ No encuentro "${finalCityName}".`);
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

			const randomizedLocation = addRandomOffset(finalCoords);
			const cleanCat = cat ? cat.trim().toUpperCase() : "GENERAL";

			const thoughtData = {
				message: msg,
				category: cleanCat,
				timestamp: serverTimestamp(),
				uid: user ? user.uid : "anonymous",
				photoURL: user ? user.photoURL : null,
				displayName: user ? user.displayName : "Anónimo",
				cityName: finalCityName,
				location: randomizedLocation,
				systemEcho: null,
			};

			// 1. Guardar en Firebase
			const docRef = await addDoc(collection(db, "thoughts"), thoughtData);

			// ============================================================
			// 2. CONEXIÓN CON TU N8N (IA VERIFICADORA)
			// ============================================================
			try {
				// ⚠️ IMPORTANTE: SI USAS N8N LOCAL, DEBES USAR 'n8n start --tunnel'
				// Y PEGAR AQUÍ LA URL PÚBLICA QUE TE DÉ (tipo https://....hooks.n8n.cloud/...)
				const N8N_WEBHOOK_URL = "PON_AQUI_LA_URL_DEL_TUNEL_O_PRODUCCION";

				fetch(N8N_WEBHOOK_URL, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: msg,
						location: finalCityName,
					}),
				})
					.then(async (response) => {
						if (response.ok) {
							const data = await response.json();
							// Si la IA devuelve un veredicto, lo mostramos
							if (data.analisis_aether) {
								alert(
									`🤖 VEREDICTO AETHER:\n\n${data.analisis_aether.veredicto}\n\n${data.analisis_aether.explicacion}`
								);
							}
						}
					})
					.catch((e) => console.log("n8n no disponible o error de red:", e));
			} catch (err) {
				console.error("Error contactando n8n:", err);
			}
			// ============================================================

			setMsg("");
			setCat("");
			setManualCity("");
			setSelectedExactLocation(null);
			setOpen(false);
		} catch (error) {
			console.error("Error:", error);
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
			<footer className="fixed bottom-0 left-0 right-0 z-50 w-full px-4 md:px-8 py-4 md:py-8 pointer-events-none flex justify-center gap-4 items-center">
				<div className="category-menu-container pointer-events-auto relative w-40 md:w-52">
					<button
						className="w-full flex items-center justify-center gap-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 cursor-pointer hover:bg-zinc-800/80 transition-colors rounded-full px-5 py-3.5 md:px-6 md:py-4 shadow-2xl"
						onClick={handleToggleCatMenu}
					>
						<Search
							className={`h-4 w-4 ${
								$searchQuery ? "text-cyan-400" : "text-zinc-500"
							}`}
						/>
						<span
							className={`text-[10px] md:text-xs font-mono uppercase truncate ${
								$searchQuery ? "text-white" : "text-zinc-500"
							}`}
						>
							{$searchQuery || "Canales"}
						</span>
						<ChevronUp
							className={`w-3 h-3 text-zinc-600 transition-transform ${
								isCatMenuOpen ? "rotate-180" : ""
							}`}
						/>
					</button>
					{isCatMenuOpen && (
						<div className="absolute bottom-[130%] left-0 w-full min-w-[200px] bg-zinc-950/95 border border-zinc-800 rounded-lg overflow-hidden animate-in slide-in-from-bottom-2">
							<div className="max-h-60 overflow-y-auto p-1">
								<button
									onClick={() => {
										searchQuery.set("");
										setIsCatMenuOpen(false);
									}}
									className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-full flex justify-between"
								>
									<span className="text-[10px] font-mono text-zinc-400 uppercase">
										Todo
									</span>
									{!$searchQuery && <Check className="w-3 h-3 text-cyan-400" />}
								</button>
								{$availableCategories.map((c) => (
									<button
										key={c}
										onClick={() => {
											searchQuery.set(c.toLowerCase());
											setIsCatMenuOpen(false);
										}}
										className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 rounded-full flex justify-between"
									>
										<span className="text-[10px] font-mono text-zinc-300 uppercase">
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
						className="w-full flex items-center justify-center gap-2 bg-emerald-700/50 backdrop-blur-xl border border-emerald-500/50 text-emerald-300 hover:text-white text-[10px] md:text-base font-mono uppercase px-5 py-3.5 md:px-6 md:py-4 rounded-full transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
					>
						<Plus size={16} /> Crear Señal
					</button>
				</div>
			</footer>

			{open && (
				<div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-60 flex items-center justify-center p-4">
					<div className="w-full max-w-lg relative animate-in zoom-in">
						<button
							onClick={() => setOpen(false)}
							className="absolute -top-10 right-0 text-zinc-500 hover:text-cyan-400 font-mono text-xs uppercase flex items-center gap-2"
						>
							[ Cerrar ] <X size={20} />
						</button>
						<div className="bg-zinc-950 border border-cyan-500/20 rounded-xl p-6 md:p-8 shadow-2xl">
							<form onSubmit={send} className="flex flex-col gap-6">
								<div className="flex gap-4">
									<div className="w-1/2 relative">
										<label className="text-[10px] text-zinc-500 font-mono uppercase mb-1 block">
											Canal
										</label>
										<input
											value={cat}
											onChange={(e) => setCat(e.target.value)}
											onFocus={() => setShowCatSuggestions(true)}
											onBlur={() =>
												setTimeout(() => setShowCatSuggestions(false), 200)
											}
											className="w-full bg-zinc-900 border border-cyan-900/50 rounded-full py-3 px-4 text-white font-mono text-sm focus:outline-none"
										/>
										{showCatSuggestions && (
											<div className="absolute top-full left-0 w-full bg-zinc-950 border border-zinc-800 rounded-lg mt-1 max-h-40 overflow-y-auto z-50">
												{filteredCats.map((c) => (
													<div
														key={c}
														onMouseDown={() => handleSelectExistingCat(c)}
														className="p-3 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-cyan-400 cursor-pointer font-mono uppercase"
													>
														{c}
													</div>
												))}
											</div>
										)}
									</div>
									<div className="w-1/2 pt-5">
										<button
											type="button"
											className={`w-full py-3 rounded-full font-mono text-[10px] uppercase border transition-all ${
												cat.trim() && !catExists
													? "bg-emerald-900/30 border-emerald-500 text-emerald-400"
													: "bg-zinc-900 border-zinc-800 text-zinc-600"
											}`}
											disabled={!cat.trim() || catExists}
										>
											{catExists ? "Existe" : "Crear Nuevo"}
										</button>
									</div>
								</div>
								<div className="bg-zinc-900 border border-zinc-800 rounded-full px-4 py-3 flex items-center">
									<MapPin className="w-4 h-4 text-cyan-500 mr-2" />
									<input
										value={manualCity}
										onChange={(e) => {
											setManualCity(e.target.value);
											setSelectedExactLocation(null);
										}}
										placeholder="UBICACIÓN (VACÍO = GPS)"
										className="bg-transparent w-full text-white font-mono text-xs focus:outline-none"
									/>
									<button
										type="button"
										onClick={handlePickLocation}
										className="text-cyan-500 hover:text-white"
									>
										<Globe size={18} />
									</button>
								</div>
								<textarea
									value={msg}
									onChange={(e) => setMsg(e.target.value)}
									className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-white font-light h-32 resize-none focus:outline-none focus:border-cyan-500/30"
									placeholder="Escribe tu señal al mundo..."
								/>
								<button
									disabled={isSending || !msg.trim()}
									className="w-full bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 py-4 rounded-full font-mono text-xs uppercase tracking-widest transition-all"
								>
									{isSending ? "Emitiendo..." : "Enviar Señal"}
								</button>
							</form>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
