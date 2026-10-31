<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { db, ref as dbRef, set, onValue, push, remove } from './firebase';

const activeTab = ref('tables'); // 'pesee', 'appel', 'tables', 'match', 'tv', 'medailles'
const selectedTapis = ref(1);
const statutConnexion = ref('Connexion en cours...');
const erreurMessage = ref('');
const filtreSexePesee = ref('TOUS');
const filtreCatPesee = ref('TOUTES');
const filtreStatutPesee = ref('TOUS'); // 'TOUS', 'A_PESER', 'PESES'
const recherchePesee = ref('');
const modeGeneration = ref('morpho');
const categorieAGenerer = ref('Mini-Poussins');
const formatPouleChoisi = ref('auto'); // 'auto', '3', '4', '5'

// Filtres de la Chambre d'Appel (PC Portable / Tablette / Mobile)
const filtreCatAppel = ref('TOUTES');
const rechercheAppel = ref('');
const afficherPoulesDejaEnvoyees = ref(false);

// Gestion de l'ajout d'un retardataire dans une poule depuis la Chambre d'Appel
const pouleEnAjoutRetardataire = ref(null);
const modeRetardataireExistant = ref(true);
const judokaSelectionnePourPoule = ref('');
const nouveauRetardataire = ref({ nom: '', club: 'USPV Judo', sexe: 'M', poids: '' });

// Menu déroulant personnalisé des clubs avec croix de suppression directe + fermeture auto au clic extérieur
const menuClubOuvert = ref(false);
const dropdownClubRef = ref(null);
const afficherSaisieNouveauClub = ref(false);
const nomNouveauClub = ref('');

const clubsDeBase = [
  'USPV Judo', 'MONTBELIARD', 'SELONCOURT', 'BLAMONT', 
  'VANDONCOURT', 'VALENTIGNEY', 'DAMPIERRE', 'MONTECHEROUX'
];

const listeClubs = ref([...clubsDeBase]);

const fermerMenuClubSiClicExterieur = (e) => {
  if (menuClubOuvert.value && dropdownClubRef.value && !dropdownClubRef.value.contains(e.target)) {
    menuClubOuvert.value = false;
  }
};

const selectionnerClubPesee = (clubNom) => {
  newJudoka.value.club = clubNom;
  menuClubOuvert.value = false;
};

const ajouterNouveauClub = async () => {
  const nom = (nomNouveauClub.value || '').trim().toUpperCase();
  if (!nom) return;

  const existant = listeClubs.value.find(c => c.toUpperCase() === nom);
  if (existant) {
    newJudoka.value.club = existant;
    clubImportLot.value = existant;
  } else {
    listeClubs.value.push(nom);
    newJudoka.value.club = nom;
    clubImportLot.value = nom;
    localStorage.setItem('uspv_clubs_secours', JSON.stringify(listeClubs.value));
    try {
      await set(dbRef(db, 'clubsPersonnalises'), listeClubs.value);
    } catch (e) {}
  }

  nomNouveauClub.value = '';
  afficherSaisieNouveauClub.value = false;
  menuClubOuvert.value = false;
};

const supprimerClub = async (clubNom) => {
  const nbJudokasClub = judokas.value.filter(j => j.club && j.club.toUpperCase() === clubNom.toUpperCase()).length;
  if (nbJudokasClub > 0) {
    alert(`Impossible de supprimer le club "${clubNom}" car ${nbJudokasClub} combattant(s) inscrit(s) y sont rattachés.`);
    return;
  }
  if (!confirm(`Supprimer le club "${clubNom}" de la liste déroulante ?`)) return;

  listeClubs.value = listeClubs.value.filter(c => c !== clubNom);
  if (newJudoka.value.club === clubNom) {
    newJudoka.value.club = listeClubs.value[0] || 'USPV Judo';
  }
  localStorage.setItem('uspv_clubs_secours', JSON.stringify(listeClubs.value));
  try {
    await set(dbRef(db, 'clubsPersonnalises'), listeClubs.value);
  } catch (e) {}
};

// Gestion du mode Plein Écran (Fullscreen API) sur l'écran déporté
const estPleinEcran = ref(false);

const basculerPleinEcran = async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      estPleinEcran.value = true;
    } else if (document.exitFullscreen) {
      await document.exitFullscreen();
      estPleinEcran.value = false;
    }
  } catch (e) {}
};

const mettreAJourEtatPleinEcran = () => {
  estPleinEcran.value = !!document.fullscreenElement;
};

// Gestion de la pré-inscription et de l'import rapide par lot
const modePreinscriptionForm = ref(false);
const idPreinscritSelectionne = ref(null);
const afficherImportLot = ref(false);
const texteImportLot = ref('');
const clubImportLot = ref('USPV Judo');
const categorieImportLot = ref('Mini-Poussins');

// Modification rapide du poids d'un judoka déjà pesé
const idJudokaEnEditionPoids = ref(null);
const poidsEditionTemp = ref('');

// --- PROTECTION PAR MOT DE PASSE ADMIN ---
const adminVerrouille = ref(true);
const motDepasseSaisi = ref('');
const erreurMotDePasse = ref(false);
const MOT_DE_PASSE_ADMIN = 'judo2026';

const verifierMotDePasse = () => {
  if (motDepasseSaisi.value.trim() === MOT_DE_PASSE_ADMIN) {
    adminVerrouille.value = false;
    erreurMotDePasse.value = false;
    motDepasseSaisi.value = '';
  } else {
    erreurMotDePasse.value = true;
    motDepasseSaisi.value = '';
  }
};

// Case à cocher d'activation du QR code / accès public
const qrCodeActif = ref(true);

// Recherche parent & Mode public
const rechercheNomParent = ref('');
const modePublic = ref(false);
const modeEcranCombat = ref(false);

// Animations IPPON et HANSOKU-MAKE sur l'écran déporté
const afficherIpponAnimation = ref(false);
const afficherHansokuAnimation = ref(false);

// Match actif par table
const matchsActifsTables = ref({
  1: null, 2: null, 3: null, 4: null, 5: null
});

// Historique par table pour le bouton "Retour Combat Précédent"
const historiqueMatchsTables = ref({
  1: [], 2: [], 3: [], 4: [], 5: []
});

const matchActif = computed({
  get: () => matchsActifsTables.value[selectedTapis.value],
  set: (val) => { matchsActifsTables.value[selectedTapis.value] = val; }
});

// Vérifie si la poule du combat actuellement affiché est entièrement terminée (pour afficher le podium du salut)
const pouleDuMatchActif = computed(() => {
  if (!matchActif.value?.pouleId) return null;
  return poules.value.find(p => p.id === matchActif.value.pouleId) || null;
});

const pouleDuMatchActifEstTerminee = computed(() => {
  return pouleDuMatchActif.value ? pouleEstTerminee(pouleDuMatchActif.value) : false;
});

// Formatage du titre de la poule sur l'écran déporté
const formaterTitrePouleTV = (nom) => {
  if (!nom) return 'En attente...';
  return nom.replace(/\s*\(Morpho\)/gi, '').trim();
};

// Chronomètre de combat
const tempsRestant = ref(180);
const chronoEnCours = ref(false);
let timer = null;

// Chrono Osaekomi (Immobilisation)
const osaekomiTemps = ref(0);
const osaekomiActif = ref(false);
const osaekomiCombattant = ref(null);
let timerOsaekomi = null;

// Calcul exact des paliers Osaekomi :
// - Mini-Poussins / Poussins / Benjamins : Waza-ari = 7s, Ippon = 15s (ratio exact = 46.67%)
// - Minimes / Cadets / Jun-Sen : Waza-ari = 10s, Ippon = 20s (ratio exact = 50.00%)
const estCategorieJeune = (nomPoule) => {
  if (!nomPoule) return false;
  const p = nomPoule.toLowerCase();
  return p.includes('benjamin') || p.includes('poussin') || p.includes('mini');
};

const seuilIpponCourant = computed(() => {
  if (matchActif.value?.seuilIpponOsae) return Number(matchActif.value.seuilIpponOsae);
  return estCategorieJeune(matchActif.value?.nomPoule) ? 15 : 20;
});

const seuilWazaCourant = computed(() => {
  return seuilIpponCourant.value === 15 ? 7 : 10;
});

const tempsOsaeAffiche = computed(() => {
  if (modeEcranCombat.value) return Number(matchActif.value?.osaekomiTemps) || 0;
  return Number(osaekomiTemps.value) || 0;
});

const pourcentageJaugeOsae = computed(() => {
  return Math.min(100, Number(((tempsOsaeAffiche.value / seuilIpponCourant.value) * 100).toFixed(2)));
});

const positionMarqueurWaza = computed(() => {
  return Number(((seuilWazaCourant.value / seuilIpponCourant.value) * 100).toFixed(2));
});

// Sécurité : si l'opérateur change de tapis à l'écran, on coupe les chronos locaux en cours
watch(selectedTapis, () => {
  if (!modeEcranCombat.value) {
    if (chronoEnCours.value) {
      chronoEnCours.value = false;
      clearInterval(timer);
    }
    if (osaekomiActif.value) {
      osaekomiActif.value = false;
      osaekomiCombattant.value = null;
      osaekomiTemps.value = 0;
      clearInterval(timerOsaekomi);
    }
  }
});

// Déclenchement automatique de l'animation IPPON sur l'écran déporté
watch(() => (matchActif.value?.c1?.ippon || 0) + (matchActif.value?.c2?.ippon || 0), (newVal, oldVal) => {
  if (oldVal !== undefined && newVal > oldVal) {
    if (modeEcranCombat.value) {
      afficherIpponAnimation.value = true;
      setTimeout(() => {
        afficherIpponAnimation.value = false;
      }, 3000);
    }
  }
});

// Déclenchement automatique de l'animation HANSOKU-MAKE sur l'écran déporté
watch(() => Math.max(matchActif.value?.c1?.shido || 0, matchActif.value?.c2?.shido || 0), (newVal, oldVal) => {
  if (oldVal !== undefined && newVal === 3 && oldVal < 3) {
    afficherHansokuAnimation.value = true;
    setTimeout(() => {
      afficherHansokuAnimation.value = false;
    }, 3000);
  }
});

// Raccourci clavier : Barre Espace pour HAJIME / MATTE
const gererRaccourciClavier = (e) => {
  if (modePublic.value || modeEcranCombat.value || adminVerrouille.value) return;
  if (activeTab.value !== 'match' || !matchActif.value) return;

  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    toggleTimer();
  }
};

// Mise en forme stricte : NOM en majuscules, Prénom avec initiale en majuscule
const formatterNom = (texte) => {
  if (!texte) return '';
  const mots = texte.trim().split(/\s+/);
  if (mots.length === 0) return '';
  const nomFamille = mots[0].toUpperCase();
  const prenoms = mots.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return prenoms ? `${nomFamille} ${prenoms}` : nomFamille;
};

// Synthèse Audio Web Audio API
let sharedAudioCtx = null;
const getAudioCtx = () => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

const jouerSonBip = () => {
  try {
    const audioCtx = getAudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {}
};

const jouerSonDoubleBip = () => {
  jouerSonBip();
  setTimeout(jouerSonBip, 250);
};

const jouerSonGongFin = () => {
  try {
    const audioCtx = getAudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 3.0);
    gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 3.0);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 3.0);
  } catch (e) {}
};

const listeCategories = [
  'Mini-Poussins', 'Poussins', 'Benjamins', 'Minimes', 'Cadets', 'Jun/Sen'
];

const newJudoka = ref({
  nom: '',
  club: 'USPV Judo',
  sexe: 'F',
  categorie: 'Mini-Poussins',
  poids: ''
});

const judokas = ref([]);
const poules = ref([]);

const normaliserJudokas = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.filter(Boolean)
    : Object.keys(raw).map(key => ({ id: key, ...raw[key] }));
  return list.map(j => {
    const estPese = j.pese !== undefined ? !!j.pese : (Number(j.poids) > 0);
    return {
      ...j,
      poids: j.poids ? Number(j.poids) : 0,
      pese: estPese,
      poidsSaisi: j.poids ? Number(j.poids) : ''
    };
  });
};

const normaliserPoules = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw.filter(Boolean)
    : Object.keys(raw).map(k => ({ id: raw[k]?.id || k, ...raw[k] }));
  return list.map((p, idx) => ({
    ...p,
    id: p.id || `poule_legacy_${idx + 1}`,
    tapis: p.tapis !== undefined && p.tapis !== null ? Number(p.tapis) : 0,
    combattants: p.combattants
      ? (Array.isArray(p.combattants) ? p.combattants.filter(Boolean) : Object.values(p.combattants)).map(c => ({
          ...c,
          presentAppel: !!c.presentAppel
        }))
      : [],
    combats: p.combats ? (Array.isArray(p.combats) ? p.combats.filter(Boolean) : Object.values(p.combats)) : []
  }));
};

// CORRECTIF #2 : Sauvegarde Firebase granulaire par clé unique (id de la poule) pour éliminer tout risque d'écrasement par décalage d'index
const convertirListePoulesEnMapFirebase = (liste) => {
  const mapObj = {};
  (liste || []).forEach(p => {
    if (p && p.id) {
      mapObj[p.id] = p;
    }
  });
  return mapObj;
};

const sauvegarderToutesLesPoulesFirebase = async (liste) => {
  localStorage.setItem('uspv_poules_secours', JSON.stringify(liste));
  await set(dbRef(db, 'poules'), convertirListePoulesEnMapFirebase(liste));
};

const sauvegarderPouleUnique = async (pouleModifiee) => {
  if (!pouleModifiee || !pouleModifiee.id) return;
  localStorage.setItem('uspv_poules_secours', JSON.stringify(poules.value));
  try {
    await set(dbRef(db, `poules/${pouleModifiee.id}`), pouleModifiee);
  } catch (e) {}
};

// Calcul officiel des points de classement FFJudo pour un combat terminé (Plafond strict à 10 pts et seul le vainqueur marque)
const calculerScoresClassementCombat = (c1, c2) => {
  const c1Ippon = (c1.ippon || 0) > 0;
  const c2Ippon = (c2.ippon || 0) > 0;

  if (c1Ippon && !c2Ippon) return { scoreC1: 10, scoreC2: 0 };
  if (c2Ippon && !c1Ippon) return { scoreC1: 0, scoreC2: 10 };

  if ((c1.waza || 0) !== (c2.waza || 0)) {
    return (c1.waza || 0) > (c2.waza || 0)
      ? { scoreC1: 7, scoreC2: 0 }
      : { scoreC1: 0, scoreC2: 7 };
  }

  if ((c1.yuko || 0) !== (c2.yuko || 0)) {
    return (c1.yuko || 0) > (c2.yuko || 0)
      ? { scoreC1: 1, scoreC2: 0 }
      : { scoreC1: 0, scoreC2: 1 };
  }

  if ((c1.shido || 0) !== (c2.shido || 0)) {
    return {
      scoreC1: 0,
      scoreC2: 0,
      vainqueurDecision: (c1.shido || 0) < (c2.shido || 0) ? c1.nom : c2.nom
    };
  }

  return { scoreC1: 0, scoreC2: 0 };
};

const urlAppPublic = computed(() => {
  if (typeof window === 'undefined') return '';
  return window.location.origin + window.location.pathname + '?public=1';
});

const urlEcranCombat = computed(() => {
  if (typeof window === 'undefined') return '';
  return window.location.origin + window.location.pathname + `?ecran=combat&tapis=${selectedTapis.value}`;
});

onMounted(() => {
  window.addEventListener('keydown', gererRaccourciClavier);
  window.addEventListener('click', fermerMenuClubSiClicExterieur);
  document.addEventListener('fullscreenchange', mettreAJourEtatPleinEcran);

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('public') === '1' || window.location.hash.includes('public=1')) {
      modePublic.value = true;
    }
    if (params.get('ecran') === 'combat') {
      modeEcranCombat.value = true;
      selectedTapis.value = Number(params.get('tapis')) || 1;
    }
  } catch (e) {}

  try {
    const localC = localStorage.getItem('uspv_clubs_secours');
    if (localC) {
      const parsedC = JSON.parse(localC);
      if (Array.isArray(parsedC) && parsedC.length > 0) {
        listeClubs.value = parsedC;
      }
    }
  } catch (e) {}

  try {
    const qrRef = dbRef(db, 'qrCodeActif');
    onValue(qrRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        qrCodeActif.value = !!val;
      }
    });

    const clubsRef = dbRef(db, 'clubsPersonnalises');
    onValue(clubsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const arr = Array.isArray(data) ? data.filter(Boolean) : Object.values(data).filter(Boolean);
        if (arr.length > 0) {
          listeClubs.value = Array.from(new Set(arr));
          localStorage.setItem('uspv_clubs_secours', JSON.stringify(listeClubs.value));
        }
      }
    });

    const judokasRef = dbRef(db, 'judokas');
    onValue(judokasRef, (snapshot) => {
      statutConnexion.value = '✅ Connecté en temps réel';
      judokas.value = normaliserJudokas(snapshot.val());
      localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
    }, () => {
      statutConnexion.value = '⚠️ Mode Hors-Ligne (Secours Local)';
      const localJ = localStorage.getItem('uspv_judokas_secours');
      if (localJ) judokas.value = normaliserJudokas(JSON.parse(localJ));
    });

    const poulesRef = dbRef(db, 'poules');
    onValue(poulesRef, (snapshot) => {
      poules.value = normaliserPoules(snapshot.val());
      localStorage.setItem('uspv_poules_secours', JSON.stringify(poules.value));
    }, () => {
      const localP = localStorage.getItem('uspv_poules_secours');
      if (localP) poules.value = normaliserPoules(JSON.parse(localP));
    });

    const matchRef = dbRef(db, 'matchsActifs');
    onValue(matchRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        matchsActifsTables.value = { 1: null, 2: null, 3: null, 4: null, 5: null, ...data };
      } else {
        matchsActifsTables.value = { 1: null, 2: null, 3: null, 4: null, 5: null };
      }
    });
  } catch (err) {
    erreurMessage.value = err.message;
    try {
      judokas.value = normaliserJudokas(JSON.parse(localStorage.getItem('uspv_judokas_secours') || '[]'));
      poules.value = normaliserPoules(JSON.parse(localStorage.getItem('uspv_poules_secours') || '[]'));
    } catch (e) {}
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', gererRaccourciClavier);
  window.removeEventListener('click', fermerMenuClubSiClicExterieur);
  document.removeEventListener('fullscreenchange', mettreAJourEtatPleinEcran);
  clearInterval(timer);
  clearInterval(timerOsaekomi);
});

const toggleQrCodeActif = async () => {
  try {
    await set(dbRef(db, 'qrCodeActif'), qrCodeActif.value);
  } catch (e) {}
};

const toggleTimer = () => {
  if (matchActif.value?.vainqueur) return;
  if (chronoEnCours.value) arreterChrono();
  else demarrerChrono();
};

// CORRECTIF #3 : Si un Osaekomi est en cours quand le chrono principal atteint 00:00, le gong sonne mais l'Osaekomi continue jusqu'à Ippon ou Toketa
const demarrerChrono = () => {
  if (chronoEnCours.value || matchActif.value?.vainqueur) return;
  chronoEnCours.value = true;
  timer = setInterval(() => {
    if (tempsRestant.value > 0) {
      tempsRestant.value--;
      syncFirebaseMatch();
    } else {
      arreterChrono();
      jouerSonGongFin();
      if (!osaekomiActif.value) {
        verifierFinDuTempsReglementaire();
      }
    }
  }, 1000);
};

const arreterChrono = () => {
  chronoEnCours.value = false;
  clearInterval(timer);
  syncFirebaseMatch();
};

const setTemps = (sec) => {
  arreterChrono();
  tempsRestant.value = sec;
  syncFirebaseMatch();
};

const formatTemps = computed(() => {
  const m = Math.floor(tempsRestant.value / 60);
  const s = tempsRestant.value % 60;
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
});

const pouleEstTerminee = (poule) => {
  if (!poule || !poule.combats || poule.combats.length === 0) return false;
  return poule.combats.every(c => c && c.statut === 'termine');
};

const changerTapisPoule = async (poule, nouveauTapis) => {
  poule.tapis = Number(nouveauTapis);
  await sauvegarderPouleUnique(poule);
};

// --- LOGIQUE DE LA CHAMBRE D'APPEL & SPEAKER ---
const statsChargeTapis = computed(() => {
  const stats = {};
  for (let t = 1; t <= 5; t++) {
    const poulesActives = poules.value.filter(p => Number(p.tapis) === t && !pouleEstTerminee(p));
    const combatsRestants = poulesActives.reduce((acc, p) => {
      return acc + (p.combats || []).filter(c => c.statut !== 'termine').length;
    }, 0);
    stats[t] = {
      nbPoulesActives: poulesActives.length,
      combatsRestants
    };
  }
  return stats;
});

const tapisLeMoinsCharge = computed(() => {
  let meilleurTapis = 1;
  let minPoules = Infinity;
  let minCombats = Infinity;
  for (let t = 1; t <= 5; t++) {
    const s = statsChargeTapis.value[t];
    if (
      s.nbPoulesActives < minPoules ||
      (s.nbPoulesActives === minPoules && s.combatsRestants < minCombats)
    ) {
      minPoules = s.nbPoulesActives;
      minCombats = s.combatsRestants;
      meilleurTapis = t;
    }
  }
  return meilleurTapis;
});

const poulesEnAttenteAppel = computed(() => {
  return poules.value.filter(p => Number(p.tapis) === 0 && !pouleEstTerminee(p));
});

const poulesChambreAppelFiltrees = computed(() => {
  const q = (rechercheAppel.value || '').trim().toUpperCase();
  const base = afficherPoulesDejaEnvoyees.value
    ? poules.value.filter(p => !pouleEstTerminee(p))
    : poulesEnAttenteAppel.value;

  return base.filter(p => {
    const matchCat = filtreCatAppel.value === 'TOUTES' || p.categorieAge === filtreCatAppel.value || (p.nom && p.nom.startsWith(filtreCatAppel.value));
    const matchRecherche =
      !q ||
      (p.nom && p.nom.toUpperCase().includes(q)) ||
      (p.combattants || []).some(c => (c.nomSeul && c.nomSeul.toUpperCase().includes(q)) || (c.club && c.club.toUpperCase().includes(q)));
    return matchCat && matchRecherche;
  });
});

const basculerPresenceAppel = async (poule, combattant) => {
  combattant.presentAppel = !combattant.presentAppel;
  await sauvegarderPouleUnique(poule);
};

const toutCocherPresentPoule = async (poule) => {
  const tousPresents = (poule.combattants || []).every(c => c.presentAppel);
  (poule.combattants || []).forEach(c => {
    c.presentAppel = !tousPresents;
  });
  await sauvegarderPouleUnique(poule);
};

const recalculerCombatsPoule = async (poule) => {
  poule.combattants.forEach((c, idx) => {
    c.numero = idx + 1;
  });

  const poidsList = poule.combattants.map(c => Number(c.poids)).filter(Boolean);
  if (poidsList.length > 0 && poule.categoriePoids && !poule.categoriePoids.includes('cat')) {
    const pMin = Math.min(...poidsList);
    const pMax = Math.max(...poidsList);
    poule.categoriePoids = `${pMin} kg à ${pMax} kg`;
  }

  const duelsBruts = getOrdreCombats(poule.combattants.length);
  const passagesRouge = {};
  poule.combattants.forEach(c => { passagesRouge[c.numero] = 0; });

  poule.combats = duelsBruts.map((duel, dIdx) => {
    let [p1, p2] = duel;
    if (passagesRouge[p1] > passagesRouge[p2]) {
      [p1, p2] = [p2, p1];
    }
    passagesRouge[p1]++;

    return {
      id: `c_${dIdx + 1}`,
      c1Num: p1,
      c2Num: p2,
      scoreC1: 0,
      scoreC2: 0,
      statut: 'attente'
    };
  });

  await sauvegarderPouleUnique(poule);
};

// CORRECTIF #6 : Protection si la poule a déjà commencé des combats sur le tapis
const retirerCombattantAbsent = async (poule, combattantIdUnique) => {
  if (poule.combattants.length <= 2) {
    alert("Impossible de retirer ce combattant : une poule doit compter au moins 2 combattants !");
    return;
  }
  const nbCombatsTermines = (poule.combats || []).filter(cb => cb && cb.statut === 'termine').length;
  if (nbCombatsTermines > 0) {
    const confirmerReset = confirm(
      `⚠️ ATTENTION : Cette poule a déjà ${nbCombatsTermines} combat(s) terminé(s) sur le tapis !\n\nRetirer un combattant maintenant va recalculer la grille et remettre les combats de cette poule à zéro.\n\nVoulez-vous vraiment continuer ?`
    );
    if (!confirmerReset) return;
  } else {
    if (!confirm(`Retirer ${poule.combattants.find(c => c.idUnique === combattantIdUnique)?.nomSeul || 'ce combattant'} de la poule ?`)) return;
  }

  poule.combattants = poule.combattants.filter(c => c.idUnique !== combattantIdUnique);
  await recalculerCombatsPoule(poule);
  alert("✅ Combattant retiré et grille des combats recalculée avec succès !");
};

const judokasDisponiblesPourRetardataire = computed(() => {
  const idsDejaPoles = new Set();
  poules.value.forEach(p => {
    (p.combattants || []).forEach(c => {
      if (c.idUnique) idsDejaPoles.add(c.idUnique);
    });
  });
  return judokas.value.filter(j => j.pese && Number(j.poids) > 0 && !idsDejaPoles.has(j.id));
});

const ouvrirModalAjoutRetardataire = (poule) => {
  const nbCombatsTermines = (poule.combats || []).filter(cb => cb && cb.statut === 'termine').length;
  if (nbCombatsTermines > 0) {
    const confirmer = confirm(
      `⚠️ ATTENTION : Cette poule a déjà ${nbCombatsTermines} combat(s) terminé(s) sur le tapis !\n\nAjouter un retardataire dans cette poule va recalculer la grille et remettre ses combats à zéro.\n\nContinuer quand même ?`
    );
    if (!confirmer) return;
  }
  pouleEnAjoutRetardataire.value = poule;
  modeRetardataireExistant.value = true;
  judokaSelectionnePourPoule.value = '';
  nouveauRetardataire.value = { nom: '', club: poule.combattants[0]?.club || 'USPV Judo', sexe: poule.sexe || 'M', poids: '' };
};

// CORRECTIF #7 : Le retardataire créé à la volée en Chambre d'Appel est aussi sauvegardé dans la liste générale `judokas`
const validerAjoutRetardataire = async () => {
  const poule = pouleEnAjoutRetardataire.value;
  if (!poule) return;

  let ajoutC = null;

  if (modeRetardataireExistant.value) {
    if (!judokaSelectionnePourPoule.value) {
      alert("Veuillez sélectionner un judoka dans la liste !");
      return;
    }
    const j = judokas.value.find(x => x.id === judokaSelectionnePourPoule.value);
    if (!j) return;
    ajoutC = {
      idUnique: j.id,
      numero: poule.combattants.length + 1,
      nomSeul: j.nom,
      club: j.club,
      poids: j.poids,
      sexe: j.sexe,
      categorie: j.categorie,
      horsConcours: false,
      presentAppel: true
    };
  } else {
    if (!nouveauRetardataire.value.nom || !nouveauRetardataire.value.poids) {
      alert("Veuillez renseigner le nom et le poids du retardataire !");
      return;
    }
    const nomF = formatterNom(nouveauRetardataire.value.nom);
    const pVal = parseFloat(nouveauRetardataire.value.poids);
    const catCible = poule.categorieAge || poule.combattants[0]?.categorie || 'Poussins';
    const sexeCible = poule.sexe || nouveauRetardataire.value.sexe || 'M';
    const payloadJudoka = {
      nom: nomF,
      club: nouveauRetardataire.value.club,
      sexe: sexeCible,
      categorie: catCible,
      poids: pVal,
      pese: true
    };

    let nouvelId = `retard_${Date.now()}`;
    try {
      const judokasRef = dbRef(db, 'judokas');
      const newRef = push(judokasRef);
      nouvelId = newRef.key || nouvelId;
      judokas.value.push({ id: nouvelId, ...payloadJudoka, poidsSaisi: pVal });
      localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
      await set(newRef, payloadJudoka);
    } catch (e) {
      judokas.value.push({ id: nouvelId, ...payloadJudoka, poidsSaisi: pVal });
      localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
    }

    ajoutC = {
      idUnique: nouvelId,
      numero: poule.combattants.length + 1,
      nomSeul: nomF,
      club: nouveauRetardataire.value.club,
      poids: pVal,
      sexe: sexeCible,
      categorie: catCible,
      horsConcours: false,
      presentAppel: true
    };
  }

  poule.combattants.push(ajoutC);
  await recalculerCombatsPoule(poule);
  pouleEnAjoutRetardataire.value = null;
  alert(`✅ ${ajoutC.nomSeul} a été ajouté à la poule avec succès !`);
};

const affecterPouleAuTapisDepuisAppel = async (poule, numTapis) => {
  poule.tapis = Number(numTapis);
  poule.envoyeTapisTimestamp = Date.now();
  await sauvegarderPouleUnique(poule);
  if (matchsActifsTables.value[Number(numTapis)]) {
    await syncFirebaseMatch();
  }
};

const remettrePouleEnChambreAppel = async (poule) => {
  poule.tapis = 0;
  await sauvegarderPouleUnique(poule);
};

const completerTapisAutomatiquement = async (maxParTapis = 3) => {
  const attente = [...poulesEnAttenteAppel.value];
  if (attente.length === 0) {
    alert("Aucune poule en attente dans la Chambre d'Appel !");
    return;
  }

  let nbEnvoyees = 0;
  for (const poule of attente) {
    let tapisCible = null;
    let minP = Infinity;
    for (let t = 1; t <= 5; t++) {
      const nbActives = poules.value.filter(p => Number(p.tapis) === t && !pouleEstTerminee(p)).length;
      if (nbActives < maxParTapis && nbActives < minP) {
        minP = nbActives;
        tapisCible = t;
      }
    }
    if (!tapisCible) break;
    poule.tapis = tapisCible;
    poule.envoyeTapisTimestamp = Date.now();
    nbEnvoyees++;
  }

  if (nbEnvoyees === 0) {
    alert(`Les 5 tables ont déjà toutes au moins ${maxParTapis} poules en cours ! Attendez qu'une table termine une poule ou envoyez manuellement.`);
    return;
  }

  try {
    await sauvegarderToutesLesPoulesFirebase(poules.value);
  } catch (e) {}
  alert(`✅ ${nbEnvoyees} poule(s) distribuée(s) sur les tapis disponibles (max ${maxParTapis} poules/table) !`);
};

const supprimerPoule = async (pouleId) => {
  if (!confirm("Voulez-vous vraiment supprimer cette poule ?")) return;
  poules.value = poules.value.filter(p => p.id !== pouleId);
  localStorage.setItem('uspv_poules_secours', JSON.stringify(poules.value));
  try {
    await remove(dbRef(db, `poules/${pouleId}`));
  } catch (e) {
    try {
      await sauvegarderToutesLesPoulesFirebase(poules.value);
    } catch (err) {}
  }
};

// File d'attente avec alternance stricte (intercale 1 combat de chaque poule active même si le 1er combat est déjà commencé)
const getFileAttentePourTapis = (tapisNum) => {
  const poulesTapis = poules.value.filter(p => Number(p.tapis) === Number(tapisNum));
  let fileMixte = [];

  const poulesTermineesTapis = poulesTapis.filter(p => pouleEstTerminee(p));
  const poulesEnCoursTapis = poulesTapis.filter(p => !pouleEstTerminee(p));

  poulesTermineesTapis.forEach(poule => {
    const combattantsList = poule.combattants || [];
    (poule.combats || []).forEach((combat, i) => {
      const c1 = combattantsList.find(c => c.numero === combat.c1Num);
      const c2 = combattantsList.find(c => c.numero === combat.c2Num);
      fileMixte.push({
        pouleId: poule.id,
        nomPoule: poule.nom,
        combatIndex: i,
        tourNum: i + 1,
        c1Num: combat.c1Num,
        c2Num: combat.c2Num,
        c1Nom: c1 ? c1.nomSeul : `#${combat.c1Num}`,
        c2Nom: c2 ? c2.nomSeul : `#${combat.c2Num}`,
        c1Club: c1 ? c1.club : '',
        c2Club: c2 ? c2.club : '',
        combat: combat
      });
    });
  });

  const maxCombats = Math.max(...poulesEnCoursTapis.map(p => (p.combats ? p.combats.length : 0)), 0);
  for (let i = 0; i < maxCombats; i++) {
    poulesEnCoursTapis.forEach(poule => {
      if (poule.combats && poule.combats[i]) {
        const combattantsList = poule.combattants || [];
        const combat = poule.combats[i];
        const c1 = combattantsList.find(c => c.numero === combat.c1Num);
        const c2 = combattantsList.find(c => c.numero === combat.c2Num);
        fileMixte.push({
          pouleId: poule.id,
          nomPoule: poule.nom,
          combatIndex: i,
          tourNum: i + 1,
          c1Num: combat.c1Num,
          c2Num: combat.c2Num,
          c1Nom: c1 ? c1.nomSeul : `#${combat.c1Num}`,
          c2Nom: c2 ? c2.nomSeul : `#${combat.c2Num}`,
          c1Club: c1 ? c1.club : '',
          c2Club: c2 ? c2.club : '',
          combat: combat
        });
      }
    });
  }

  return fileMixte;
};

// Sélectionne le prochain combat en garantissant l'alternance entre les poules actives
const trouverProchainCombatAlternance = (tapisCible, pouleIdActuelle, combatIdActuel) => {
  const file = getFileAttentePourTapis(tapisCible);
  const enAttente = file.filter(f => f.combat.statut !== 'termine' && !(f.pouleId === pouleIdActuelle && f.combat.id === combatIdActuel));
  if (enAttente.length === 0) return null;

  const autrePoule = enAttente.filter(f => f.pouleId !== pouleIdActuelle);
  if (autrePoule.length > 0) {
    const minTourGlobal = Math.min(...enAttente.map(f => f.tourNum));
    const candidatAutrePoule = autrePoule.find(f => f.tourNum <= minTourGlobal);
    if (candidatAutrePoule) return candidatAutrePoule;
  }

  const currentIndex = file.findIndex(f => f.pouleId === pouleIdActuelle && f.combat.id === combatIdActuel);
  if (currentIndex !== -1) {
    for (let i = currentIndex + 1; i < file.length; i++) {
      if (file[i].combat.statut !== 'termine') return file[i];
    }
  }
  return enAttente[0];
};

const syncFirebaseMatch = async () => {
  if (!matchActif.value) return;
  const tapisCible = matchActif.value.tapis || selectedTapis.value;
  matchActif.value.tempsRestant = formatTemps.value;
  matchActif.value.osaekomiActif = osaekomiActif.value;
  matchActif.value.osaekomiTemps = osaekomiTemps.value;
  matchActif.value.osaekomiCombattant = osaekomiCombattant.value;
  matchActif.value.seuilIpponOsae = estCategorieJeune(matchActif.value.nomPoule) ? 15 : 20;

  const prochain = trouverProchainCombatAlternance(tapisCible, matchActif.value.pouleId, matchActif.value.combatId);

  if (prochain) {
    matchActif.value.prochainCombat = `[${formaterTitrePouleTV(prochain.nomPoule)}] 🟥 ${prochain.c1Nom} vs ⬜ ${prochain.c2Nom}`;
    matchActif.value.prochainCombatDetails = {
      nomPoule: prochain.nomPoule,
      rouge: { numero: prochain.c1Num, nom: prochain.c1Nom, club: prochain.c1Club },
      blanc: { numero: prochain.c2Num, nom: prochain.c2Nom, club: prochain.c2Club }
    };
  } else {
    matchActif.value.prochainCombat = "Fin des combats actuels sur ce tapis.";
    matchActif.value.prochainCombatDetails = null;
  }

  try {
    await set(dbRef(db, `matchsActifs/${tapisCible}`), matchActif.value);
  } catch (e) {}
};

const startOsae = (num) => {
  if (matchActif.value?.vainqueur) return;
  osaekomiCombattant.value = num;
  osaekomiTemps.value = 0;
  osaekomiActif.value = true;
  clearInterval(timerOsaekomi);
  
  const isJeune = estCategorieJeune(matchActif.value?.nomPoule);
  const seuilWaza = isJeune ? 7 : 10;
  const seuilIppon = isJeune ? 15 : 20;

  timerOsaekomi = setInterval(() => {
    osaekomiTemps.value++;
    if (osaekomiTemps.value === seuilWaza) {
      updateScore(osaekomiCombattant.value, 'waza', 1);
      jouerSonDoubleBip();
      if (matchActif.value?.vainqueur) {
        toketa();
        return;
      }
    } else if (osaekomiTemps.value >= seuilIppon) {
      const target = osaekomiCombattant.value === 1 ? matchActif.value.c1 : matchActif.value.c2;
      target.waza = Math.max(0, target.waza - 1);
      updateScore(osaekomiCombattant.value, 'ippon', 1);
      toketa();
      return;
    }
    syncFirebaseMatch();
  }, 1000);
  syncFirebaseMatch();
};

// CORRECTIF #3 : Si le temps réglementaire était déjà écoulé (00:00) pendant l'Osaekomi et qu'on clique sur Toketa avant l'Ippon, on déclenche la fin du match
const toketa = () => {
  const etaitActif = osaekomiActif.value;
  osaekomiActif.value = false;
  osaekomiCombattant.value = null;
  osaekomiTemps.value = 0;
  clearInterval(timerOsaekomi);
  syncFirebaseMatch();

  if (etaitActif && tempsRestant.value === 0 && !chronoEnCours.value && matchActif.value && !matchActif.value.vainqueur) {
    verifierFinDuTempsReglementaire();
  }
};

const annulerVictoireEnCours = async () => {
  if (!matchActif.value) return;
  matchActif.value.vainqueur = null;
  matchActif.value.clubVainqueur = null;
  matchActif.value.egaliteTotale = false;

  const poule = poules.value.find(p => p.id === matchActif.value.pouleId);
  if (poule && poule.combats) {
    const combat = poule.combats.find(c => c.id === matchActif.value.combatId);
    if (combat) {
      combat.statut = 'attente';
      delete combat.vainqueurDecision;
      poule.termineTimestamp = null;
      poule.prepareMedaille = false;
      await sauvegarderPouleUnique(poule);
    }
  }
  await syncFirebaseMatch();
};

// CORRECTIF #4 : Utilisation du barème officiel FFJudo plafonné (10 / 7 / 1 / 0) lors de la victoire
const declencherVictoire = async (nomVainqueur, clubVainqueur, estEgalite = false, parDecision = false, parDisqualification = false) => {
  if (!matchActif.value) return;
  if (matchActif.value.vainqueur && !matchActif.value.egaliteTotale) return;

  arreterChrono();
  toketa();

  matchActif.value.vainqueur = nomVainqueur;
  matchActif.value.clubVainqueur = clubVainqueur;
  matchActif.value.egaliteTotale = estEgalite;

  const poule = poules.value.find(p => p.id === matchActif.value.pouleId);
  if (poule && poule.combats) {
    const combat = poule.combats.find(c => c.id === matchActif.value.combatId);
    if (combat) {
      if (estEgalite) {
        combat.scoreC1 = 0;
        combat.scoreC2 = 0;
        delete combat.vainqueurDecision;
      } else if (parDisqualification) {
        combat.scoreC1 = matchActif.value.c1.nom === nomVainqueur ? 10 : 0;
        combat.scoreC2 = matchActif.value.c2.nom === nomVainqueur ? 10 : 0;
        combat.vainqueurDecision = nomVainqueur;
      } else if (parDecision) {
        combat.scoreC1 = 0;
        combat.scoreC2 = 0;
        combat.vainqueurDecision = nomVainqueur;
      } else {
        const resScores = calculerScoresClassementCombat(matchActif.value.c1, matchActif.value.c2);
        combat.scoreC1 = resScores.scoreC1;
        combat.scoreC2 = resScores.scoreC2;
        if (resScores.vainqueurDecision) {
          combat.vainqueurDecision = resScores.vainqueurDecision;
        } else {
          delete combat.vainqueurDecision;
        }
      }
      combat.statut = 'termine';

      if (pouleEstTerminee(poule) && !poule.termineTimestamp) {
        poule.termineTimestamp = Date.now();
        poule.prepareMedaille = false;
      }

      await sauvegarderPouleUnique(poule);
    }
  }

  await syncFirebaseMatch();
};

const verifierFinDuTempsReglementaire = () => {
  if (!matchActif.value || matchActif.value.vainqueur) return;
  const c1 = matchActif.value.c1;
  const c2 = matchActif.value.c2;

  if (c1.ippon > c2.ippon) { declencherVictoire(c1.nom, c1.club); return; }
  if (c2.ippon > c1.ippon) { declencherVictoire(c2.nom, c2.club); return; }

  if (c1.waza > c2.waza) { declencherVictoire(c1.nom, c1.club); return; }
  if (c2.waza > c1.waza) { declencherVictoire(c2.nom, c2.club); return; }

  if (c1.yuko > c2.yuko) { declencherVictoire(c1.nom, c1.club); return; }
  if (c2.yuko > c1.yuko) { declencherVictoire(c2.nom, c2.club); return; }

  if (c1.shido < c2.shido) { declencherVictoire(c1.nom, c1.club, false, true); return; }
  if (c2.shido < c1.shido) { declencherVictoire(c2.nom, c2.club, false, true); return; }

  matchActif.value.egaliteTotale = true;
  matchActif.value.vainqueur = "ÉGALITÉ PARFAITE";
  matchActif.value.clubVainqueur = "EN ATTENTE DE DÉCISION";
  arreterChrono();
  toketa();
  syncFirebaseMatch();
};

const updateScore = (playerNum, type, val) => {
  if (!matchActif.value || matchActif.value.vainqueur) return;
  const target = playerNum === 1 ? matchActif.value.c1 : matchActif.value.c2;

  target[type] = Math.max(0, target[type] + val);

  if (target.waza >= 2) {
    target.waza -= 2;
    target.ippon += 1;
    jouerSonDoubleBip();
  }

  if (target.ippon > 0) {
    declencherVictoire(target.nom, target.club);
  } else {
    syncFirebaseMatch();
  }
};

const updateShido = (playerNum, val) => {
  if (!matchActif.value || matchActif.value.vainqueur) return;
  const target = playerNum === 1 ? matchActif.value.c1 : matchActif.value.c2;
  const adversaire = playerNum === 1 ? matchActif.value.c2 : matchActif.value.c1;

  target.shido = Math.max(0, Math.min(3, target.shido + val));

  if (target.shido === 3) {
    declencherVictoire(adversaire.nom, adversaire.club, false, false, true);
  } else {
    syncFirebaseMatch();
  }
};

// --- SYSTÈME DE RAPPEL D'IDENTITÉ & PRÉ-INSCRIPTION ---
const suggestionsPreinscrits = computed(() => {
  const saisie = (newJudoka.value.nom || '').trim().toUpperCase();
  if (saisie.length < 2 || idPreinscritSelectionne.value) return [];
  return judokas.value
    .filter(j => !j.pese && j.nom && j.nom.toUpperCase().includes(saisie))
    .slice(0, 5);
});

const chargerPreinscritDansFormulaire = (j) => {
  idPreinscritSelectionne.value = j.id;
  newJudoka.value.nom = j.nom;
  newJudoka.value.club = j.club;
  newJudoka.value.sexe = j.sexe;
  newJudoka.value.categorie = j.categorie;
  newJudoka.value.poids = j.poids > 0 ? j.poids : '';
  modePreinscriptionForm.value = false;
};

const annulerSelectionPreinscrit = () => {
  idPreinscritSelectionne.value = null;
  newJudoka.value.nom = '';
  newJudoka.value.poids = '';
};

const ajouterJudoka = async () => {
  if (!newJudoka.value.nom) return;
  menuClubOuvert.value = false;
  const poidsNum = parseFloat(newJudoka.value.poids);
  const aUnPoidsValide = !isNaN(poidsNum) && poidsNum > 0;

  if (idPreinscritSelectionne.value) {
    if (!aUnPoidsValide && !modePreinscriptionForm.value) {
      alert("Veuillez saisir le poids réel mesuré sur la balance pour valider ce pré-inscrit.");
      return;
    }
    const cible = judokas.value.find(j => j.id === idPreinscritSelectionne.value);
    if (cible) {
      cible.nom = formatterNom(newJudoka.value.nom);
      cible.club = newJudoka.value.club;
      cible.sexe = newJudoka.value.sexe;
      cible.categorie = newJudoka.value.categorie;
      cible.poids = aUnPoidsValide ? poidsNum : 0;
      cible.pese = aUnPoidsValide && !modePreinscriptionForm.value;
      cible.poidsSaisi = cible.poids || '';

      localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
      try {
        await set(dbRef(db, `judokas/${cible.id}`), {
          nom: cible.nom,
          club: cible.club,
          sexe: cible.sexe,
          categorie: cible.categorie,
          poids: cible.poids,
          pese: cible.pese
        });
      } catch (e) {}
    }
    categorieAGenerer.value = newJudoka.value.categorie;
    idPreinscritSelectionne.value = null;
    newJudoka.value.nom = '';
    newJudoka.value.poids = '';
    return;
  }

  const estPeseDirectement = aUnPoidsValide && !modePreinscriptionForm.value;
  const nomFormate = formatterNom(newJudoka.value.nom);
  const payload = {
    nom: nomFormate,
    club: newJudoka.value.club,
    sexe: newJudoka.value.sexe,
    categorie: newJudoka.value.categorie,
    poids: aUnPoidsValide ? poidsNum : 0,
    pese: estPeseDirectement
  };

  try {
    const judokasRef = dbRef(db, 'judokas');
    const newRef = push(judokasRef);
    const nouveauJ = { id: newRef.key, ...payload, poidsSaisi: payload.poids || '' };

    judokas.value.push(nouveauJ);
    localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
    await set(newRef, payload);
  } catch (e) {
    const nouveauJ = {
      id: `j_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...payload,
      poidsSaisi: payload.poids || ''
    };
    judokas.value.push(nouveauJ);
    localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
  }

  categorieAGenerer.value = newJudoka.value.categorie;
  newJudoka.value.nom = '';
  newJudoka.value.poids = '';
};

const validerPeseeJudoka = async (j) => {
  const p = parseFloat(j.poidsSaisi !== undefined && j.poidsSaisi !== '' ? j.poidsSaisi : j.poids);
  if (isNaN(p) || p <= 0) {
    alert("Veuillez entrer un poids réel valide (ex: 28.4) avant de valider la pesée.");
    return;
  }
  j.poids = p;
  j.poidsSaisi = p;
  j.pese = true;
  idJudokaEnEditionPoids.value = null;

  localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
  try {
    await set(dbRef(db, `judokas/${j.id}`), {
      nom: j.nom,
      club: j.club,
      sexe: j.sexe,
      categorie: j.categorie,
      poids: j.poids,
      pese: true
    });
  } catch (e) {}
};

const ouvrirEditionPoids = (j) => {
  idJudokaEnEditionPoids.value = j.id;
  poidsEditionTemp.value = j.poids || '';
};

const sauvegarderEditionPoids = async (j) => {
  const p = parseFloat(poidsEditionTemp.value);
  if (isNaN(p) || p <= 0) {
    j.poids = 0;
    j.poidsSaisi = '';
    j.pese = false;
  } else {
    j.poids = p;
    j.poidsSaisi = p;
    j.pese = true;
  }
  idJudokaEnEditionPoids.value = null;

  localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
  try {
    await set(dbRef(db, `judokas/${j.id}`), {
      nom: j.nom,
      club: j.club,
      sexe: j.sexe,
      categorie: j.categorie,
      poids: j.poids,
      pese: j.pese
    });
  } catch (e) {}
};

const importerListePreinscrits = async () => {
  const lignes = (texteImportLot.value || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lignes.length === 0) return;

  let compteur = 0;
  let clubsModifies = false;

  for (const ligne of lignes) {
    const morceaux = ligne.split(/[;\t,]+/).map(s => s.trim()).filter(Boolean);
    if (morceaux.length === 0) continue;

    const nom = formatterNom(morceaux[0]);
    let club = clubImportLot.value;
    let sexe = 'M';
    let categorie = categorieImportLot.value;
    let poidsAnnonce = 0;

    morceaux.slice(1).forEach(item => {
      const up = item.toUpperCase();
      const num = parseFloat(item.replace(',', '.'));
      if (up === 'F' || up === 'FEMININ' || up === 'FÉMININ' || up === 'FILLE') {
        sexe = 'F';
      } else if (up === 'M' || up === 'MASCULIN' || up === 'GARCON' || up === 'GARÇON') {
        sexe = 'M';
      } else if (!isNaN(num) && num > 10 && num < 200) {
        poidsAnnonce = num;
      } else {
        const catTrouvee = listeCategories.find(c => c.toUpperCase() === up || up.includes(c.toUpperCase().slice(0, 5)));
        if (catTrouvee) {
          categorie = catTrouvee;
        } else {
          const clubTrouve = listeClubs.value.find(cl => cl.toUpperCase().includes(up) || up.includes(cl.toUpperCase()));
          if (clubTrouve) {
            club = clubTrouve;
          } else {
            club = up;
            if (!listeClubs.value.some(cl => cl.toUpperCase() === up)) {
              listeClubs.value.push(up);
              clubsModifies = true;
            }
          }
        }
      }
    });

    const payload = {
      nom,
      club,
      sexe,
      categorie,
      poids: poidsAnnonce,
      pese: false
    };

    try {
      const judokasRef = dbRef(db, 'judokas');
      const newRef = push(judokasRef);
      judokas.value.push({ id: newRef.key, ...payload, poidsSaisi: payload.poids || '' });
      await set(newRef, payload);
    } catch (e) {
      judokas.value.push({
        id: `j_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ...payload,
        poidsSaisi: payload.poids || ''
      });
    }
    compteur++;
  }

  if (clubsModifies) {
    localStorage.setItem('uspv_clubs_secours', JSON.stringify(listeClubs.value));
    try {
      await set(dbRef(db, 'clubsPersonnalises'), listeClubs.value);
    } catch (e) {}
  }

  localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
  texteImportLot.value = '';
  afficherImportLot.value = false;
  filtreStatutPesee.value = 'A_PESER';
  alert(`✅ ${compteur} combattant(s) pré-inscrit(s) ajouté(s) en attente de pesée !`);
};

const supprimerJudoka = async (id) => {
  if (confirm("Supprimer ce combattant ?")) {
    judokas.value = judokas.value.filter(j => j.id !== id);
    localStorage.setItem('uspv_judokas_secours', JSON.stringify(judokas.value));
    try {
      await remove(dbRef(db, `judokas/${id}`));
    } catch (e) {}
  }
};

const reinitialiserTout = async () => {
  const confirmation1 = confirm("⚠️ ATTENTION : Vous êtes sur le point de TOUT EFFACER (tous les inscrits, toutes les poules et tous les scores). Voulez-vous continuer ?");
  if (!confirmation1) return;

  const confirmation2 = confirm("🚨 DERNIÈRE CONFIRMATION : Cette action remet le tournoi à zéro. Êtes-vous sûr ?");
  if (!confirmation2) return;

  try {
    arreterChrono();
    toketa();
    judokas.value = [];
    poules.value = [];
    matchsActifsTables.value = { 1: null, 2: null, 3: null, 4: null, 5: null };
    historiqueMatchsTables.value = { 1: [], 2: [], 3: [], 4: [], 5: [] };

    localStorage.removeItem('uspv_judokas_secours');
    localStorage.removeItem('uspv_poules_secours');

    await set(dbRef(db, 'judokas'), null);
    await set(dbRef(db, 'poules'), null);
    await set(dbRef(db, 'matchsActifs'), null);

    alert("✅ Le tournoi a été entièrement réinitialisé à zéro.");
  } catch (err) {
    alert("Erreur lors de la réinitialisation : " + err.message);
  }
};

const getOrdreCombats = (N) => {
  if (N === 3) return [[1,2], [2,3], [1,3]];
  if (N === 4) return [[1,2], [3,4], [1,3], [2,4], [1,4], [2,3]];
  if (N === 5) return [[1,2], [3,4], [1,5], [2,3], [4,5], [1,3], [2,5], [1,4], [3,5], [2,4]];
  if (N === 6) return [[1,2], [3,4], [5,6], [1,3], [2,5], [4,6], [1,5], [3,6], [2,4], [1,6], [2,3], [4,5], [1,4], [3,5], [2,6]];
  return [[1,2]];
};

const getCategorieOfficiellePoids = (catAge, sexe, poids) => {
  poids = Number(poids);
  if (catAge === 'Mini-Poussins' || catAge === 'Poussins') {
    if (poids <= 25) return '-25 kg';
    if (poids <= 28) return '-28 kg';
    if (poids <= 32) return '-32 kg';
    if (poids <= 36) return '-36 kg';
    if (poids <= 40) return '-40 kg';
    return '+40 kg';
  } else if (catAge === 'Benjamins') {
    if (poids <= 30) return '-30 kg';
    if (poids <= 34) return '-34 kg';
    if (poids <= 38) return '-38 kg';
    if (poids <= 42) return '-42 kg';
    if (poids <= 46) return '-46 kg';
    if (poids <= 50) return '-50 kg';
    return '+50 kg';
  } else if (catAge === 'Minimes') {
    if (sexe === 'M') {
      if (poids <= 34) return '-34 kg';
      if (poids <= 38) return '-38 kg';
      if (poids <= 42) return '-42 kg';
      if (poids <= 46) return '-46 kg';
      if (poids <= 50) return '-50 kg';
      if (poids <= 55) return '-55 kg';
      if (poids <= 60) return '-60 kg';
      return '+60 kg';
    } else {
      if (poids <= 32) return '-32 kg';
      if (poids <= 36) return '-36 kg';
      if (poids <= 40) return '-40 kg';
      if (poids <= 44) return '-44 kg';
      if (poids <= 48) return '-48 kg';
      if (poids <= 52) return '-52 kg';
      if (poids <= 57) return '-57 kg';
      return '+57 kg';
    }
  }
  return `${Math.floor(poids / 5) * 5} kg cat`;
};

// CORRECTIF #1 : Protection intégrale des poules déjà envoyées sur un tapis (tapis > 0) lors de la génération d'une catégorie
const genererPoulesCategorie = async () => {
  const catCible = categorieAGenerer.value;

  // On conserve toutes les poules d'autres catégories ET toutes les poules déjà envoyées sur un tapis (tapis > 0)
  let poulesConservees = [];
  if (catCible !== 'TOUTES') {
    poulesConservees = poules.value.filter(p => {
      const estMemeCategorie = p.categorieAge === catCible || (p.nom && p.nom.startsWith(catCible));
      if (!estMemeCategorie) return true;
      return Number(p.tapis) > 0;
    });
  } else {
    const poulesActivesSurTapis = poules.value.filter(p => Number(p.tapis) > 0);
    if (poulesActivesSurTapis.length > 0) {
      const ecraserTout = confirm(
        `⚠️ Il y a actuellement ${poulesActivesSurTapis.length} poule(s) déjà envoyée(s) sur les tapis.\n\nVoulez-vous conserver ces poules sur tapis et ne générer que les nouveaux combattants ? (Cliquez sur Annuler pour tout remplacer)`
      );
      if (ecraserTout) {
        poulesConservees = poulesActivesSurTapis;
      }
    }
  }

  // Identifiants des combattants déjà engagés sur un tapis dans les poules conservées
  const idsDejaSurTapis = new Set();
  poulesConservees.forEach(p => {
    (p.combattants || []).forEach(c => {
      if (c && c.idUnique) idsDejaSurTapis.add(c.idUnique);
    });
  });

  const judokasAInscrire = judokas.value.filter(j => 
    j.pese &&
    Number(j.poids) > 0 &&
    !idsDejaSurTapis.has(j.id) &&
    (catCible === 'TOUTES' ? true : j.categorie === catCible)
  );

  const nbNonPesesCat = judokas.value.filter(j => 
    !j.pese && (catCible === 'TOUTES' ? true : j.categorie === catCible)
  ).length;

  if (judokasAInscrire.length === 0) {
    alert(`Aucun nouveau combattant PESÉ disponible à générer en "${catCible}" ! (Les combattants déjà sur tapis sont protégés, et ${nbNonPesesCat} pré-inscrit(s) sont encore en attente de pesée).`);
    return;
  }

  if (nbNonPesesCat > 0) {
    const confirmerMalgreAttente = confirm(
      `ℹ️ Attention : Il reste ${nbNonPesesCat} pré-inscrit(s) NON PESÉ(S) en "${catCible}".\n\nSeuls les ${judokasAInscrire.length} combattants ayant validé leur pesée (et non encore sur tapis) seront placés dans les nouvelles poules.\n\nContinuer ?`
    );
    if (!confirmerMalgreAttente) return;
  }

  const groupesParCle = {};
  judokasAInscrire.forEach(j => {
    let cle = modeGeneration.value === 'morpho' 
      ? `${j.categorie} ${j.sexe} (Morpho)` 
      : `${j.categorie} ${j.sexe} — ${getCategorieOfficiellePoids(j.categorie, j.sexe, j.poids)}`;
    if (!groupesParCle[cle]) groupesParCle[cle] = [];
    groupesParCle[cle].push({ ...j });
  });

  let groupesTraites = [];
  let combattantsIsoles = [];

  Object.keys(groupesParCle).forEach(cle => {
    const liste = groupesParCle[cle].sort((a, b) => a.poids - b.poids);
    if (liste.length === 1) {
      combattantsIsoles.push(liste[0]);
    } else {
      groupesTraites.push({ cle, liste });
    }
  });

  combattantsIsoles.forEach(isole => {
    let meilleureCle = null;
    let minDiffPoids = Infinity;

    groupesTraites.forEach(g => {
      const premierMembre = g.liste[0];
      if (premierMembre.categorie === isole.categorie && premierMembre.sexe === isole.sexe) {
        const poidsMoyen = g.liste.reduce((acc, cur) => acc + cur.poids, 0) / g.liste.length;
        const diff = Math.abs(isole.poids - poidsMoyen);
        if (diff < minDiffPoids) {
          minDiffPoids = diff;
          meilleureCle = g.cle;
        }
      }
    });

    if (meilleureCle) {
      const groupeCible = groupesTraites.find(g => g.cle === meilleureCle);
      if (groupeCible) {
        groupeCible.liste.push({ ...isole, horsConcours: true });
      }
    } else {
      groupesTraites.push({ cle: `${isole.categorie} ${isole.sexe} (Isolé)`, liste: [isole] });
    }
  });

  let nouvellesPoulesBrutes = [];
  groupesTraites.forEach(({ cle, liste }) => {
    const listeTriee = liste.sort((a, b) => a.poids - b.poids);
    const N = listeTriee.length;
    if (N === 0) return;

    let tailleMaxPoule = 4;
    if (formatPouleChoisi.value === '3') tailleMaxPoule = 3;
    else if (formatPouleChoisi.value === '4') tailleMaxPoule = 4;
    else if (formatPouleChoisi.value === '5') tailleMaxPoule = 5;
    else {
      tailleMaxPoule = N <= 5 ? 5 : 4;
    }

    const nbPoules = Math.ceil(N / tailleMaxPoule);
    const partitions = Array.from({ length: nbPoules }, () => []);
    listeTriee.forEach((j, i) => {
      const pIdx = Math.floor((i * nbPoules) / N);
      partitions[pIdx].push(j);
    });

    if (nbPoules > 1) {
      const ecartMaxTolere = modeGeneration.value === 'morpho' ? 2.5 : 99;

      for (let p = 0; p < nbPoules; p++) {
        const pouleActuelle = partitions[p];
        
        for (let i = 0; i < pouleActuelle.length; i++) {
          const c1 = pouleActuelle[i];
          const doublonClub = pouleActuelle.some((autre, idx) => idx !== i && autre.club === c1.club);
          
          if (doublonClub) {
            const poulesVoisines = [p + 1, p - 1].filter(idx => idx >= 0 && idx < nbPoules);
            let echangeEffectue = false;

            for (const pVoisin of poulesVoisines) {
              if (echangeEffectue) break;
              const pouleVoisine = partitions[pVoisin];

              for (let j = 0; j < pouleVoisine.length; j++) {
                const candidat = pouleVoisine[j];
                const diffPoids = Math.abs(Number(c1.poids) - Number(candidat.poids));

                const candidatCreeraitDoublonIci = pouleActuelle.some((x, idx) => idx !== i && x.club === candidat.club);
                const c1CreeraitDoublonLaBas = pouleVoisine.some((x, idx) => idx !== j && x.club === c1.club);

                if (
                  candidat.club !== c1.club &&
                  diffPoids <= ecartMaxTolere &&
                  !candidatCreeraitDoublonIci &&
                  !c1CreeraitDoublonLaBas
                ) {
                  pouleActuelle[i] = candidat;
                  pouleVoisine[j] = c1;
                  echangeEffectue = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    partitions.forEach(poule => {
      poule.sort((a, b) => a.poids - b.poids);
      const clubsCount = {};
      poule.forEach(c => { clubsCount[c.club] = (clubsCount[c.club] || 0) + 1; });
      poule.sort((a, b) => (clubsCount[b.club] - clubsCount[a.club]) || a.club.localeCompare(b.club) || (a.poids - b.poids));
    });

    // Numérotation continue des groupes si certaines poules de cette clé sont déjà sur tapis
    const nbDejaSurTapisMemeCle = poulesConservees.filter(p => p.nom && p.nom.startsWith(cle)).length;

    partitions.forEach((combattants, pIdx) => {
      const numGroupe = nbDejaSurTapisMemeCle + pIdx + 1;
      const nomPoule = (nbPoules > 1 || nbDejaSurTapisMemeCle > 0) ? `${cle} (Gr ${numGroupe})` : cle;
      const catAgeOrigine = combattants[0]?.categorie || catCible;
      const sexeOrigine = combattants[0]?.sexe || 'M';
      const poidsList = combattants.map(c => Number(c.poids));
      const pMin = Math.min(...poidsList);
      const pMax = Math.max(...poidsList);
      const tranchePoids = modeGeneration.value === 'morpho' 
        ? `${pMin} kg à ${pMax} kg` 
        : getCategorieOfficiellePoids(catAgeOrigine, sexeOrigine, pMax);
      
      const listeCombattants = combattants.map((c, cIdx) => {
        const nomFormate = formatterNom(c.nom);
        return {
          idUnique: c.id || `j_${Math.random().toString(36).substr(2, 9)}`,
          numero: cIdx + 1,
          nomSeul: nomFormate,
          club: c.club,
          poids: c.poids,
          sexe: c.sexe,
          categorie: c.categorie,
          horsConcours: !!c.horsConcours,
          presentAppel: false
        };
      });

      const duelsBruts = getOrdreCombats(listeCombattants.length);
      const passagesRouge = {};
      listeCombattants.forEach(c => { passagesRouge[c.numero] = 0; });

      const combatsPoule = duelsBruts.map((duel, dIdx) => {
        let [p1, p2] = duel;
        if (passagesRouge[p1] > passagesRouge[p2]) {
          [p1, p2] = [p2, p1];
        }
        passagesRouge[p1]++;

        return {
          id: `c_${dIdx + 1}`,
          c1Num: p1,
          c2Num: p2,
          scoreC1: 0,
          scoreC2: 0,
          statut: 'attente'
        };
      });

      nouvellesPoulesBrutes.push({
        nom: nomPoule,
        categorieAge: catAgeOrigine,
        sexe: sexeOrigine,
        categoriePoids: tranchePoids,
        combattants: listeCombattants,
        combats: combatsPoule
      });
    });
  });

  const timestamp = Date.now();
  let nouvellesPoulesFinales = nouvellesPoulesBrutes.map((poule, idx) => {
    return {
      id: `poule_${timestamp}_${idx + 1}`,
      nom: poule.nom,
      categorieAge: poule.categorieAge,
      sexe: poule.sexe,
      categoriePoids: poule.categoriePoids,
      tapis: 0,
      combattants: poule.combattants,
      combats: poule.combats,
      termineTimestamp: null,
      prepareMedaille: false
    };
  });

  const listeFinaleCombinee = [...poulesConservees, ...nouvellesPoulesFinales];
  poules.value = listeFinaleCombinee;

  try {
    await sauvegarderToutesLesPoulesFirebase(listeFinaleCombinee);
    alert(`✅ ${nouvellesPoulesFinales.length} poule(s) générée(s) et envoyée(s) dans l'onglet "📢 Appel & Speaker" !`);
    activeTab.value = 'appel';
  } catch (e) {
    alert(`⚠️ Coupure Internet détectée : Sauvegardé en local de secours.`);
    activeTab.value = 'appel';
  }
};

const nbTotalPeses = computed(() => judokas.value.filter(j => j.pese).length);
const nbTotalAPeser = computed(() => judokas.value.filter(j => !j.pese).length);

const judokasFiltres = computed(() => {
  const q = (recherchePesee.value || '').trim().toUpperCase();
  return judokas.value
    .filter(j => {
      const matchSexe = filtreSexePesee.value === 'TOUS' || j.sexe === filtreSexePesee.value;
      const matchCat = filtreCatPesee.value === 'TOUTES' || j.categorie === filtreCatPesee.value;
      const matchStatut =
        filtreStatutPesee.value === 'TOUS' ||
        (filtreStatutPesee.value === 'A_PESER' && !j.pese) ||
        (filtreStatutPesee.value === 'PESES' && j.pese);
      const matchRecherche =
        !q ||
        (j.nom && j.nom.toUpperCase().includes(q)) ||
        (j.club && j.club.toUpperCase().includes(q));
      return matchSexe && matchCat && matchStatut && matchRecherche;
    })
    .sort((a, b) => {
      if (a.pese !== b.pese) return a.pese ? 1 : -1;
      return (a.nom || '').localeCompare(b.nom || '');
    });
});

const lancerCombatTable = (item, tapisNum, etatRestaure = null) => {
  arreterChrono();
  toketa();
  selectedTapis.value = tapisNum;
  const poule = poules.value.find(p => p.id === item.pouleId);
  if (!poule || !poule.combattants) return;

  const c1 = poule.combattants.find(c => c.numero === item.combat.c1Num);
  const c2 = poule.combattants.find(c => c.numero === item.combat.c2Num);
  if (!c1 || !c2) return;

  if (etatRestaure) {
    matchActif.value = JSON.parse(JSON.stringify(etatRestaure.match));
    matchActif.value.vainqueur = null;
    matchActif.value.clubVainqueur = null;
    matchActif.value.egaliteTotale = false;
    setTemps(etatRestaure.tempsRestantSecondes || 180);
  } else {
    matchActif.value = {
      pouleId: poule.id,
      combatId: item.combat.id,
      nomPoule: poule.nom,
      tapis: tapisNum,
      c1: { idUnique: c1.idUnique, numero: c1.numero, nom: c1.nomSeul, club: c1.club, ippon: 0, waza: 0, yuko: 0, shido: 0 },
      c2: { idUnique: c2.idUnique, numero: c2.numero, nom: c2.nomSeul, club: c2.club, ippon: 0, waza: 0, yuko: 0, shido: 0 },
      tempsRestant: '03:00',
      osaekomiActif: false,
      osaekomiTemps: 0,
      osaekomiCombattant: null,
      seuilIpponOsae: estCategorieJeune(poule.nom) ? 15 : 20,
      prochainCombat: 'Chargement...',
      prochainCombatDetails: null,
      vainqueur: null,
      clubVainqueur: null,
      egaliteTotale: false
    };
    setTemps(180);
  }
  toketa();
  syncFirebaseMatch();
  activeTab.value = 'match';
};

const retourCombatPrecedent = async () => {
  const tapisActuel = matchActif.value?.tapis || selectedTapis.value;
  arreterChrono();
  toketa();

  const pileHistorique = historiqueMatchsTables.value[tapisActuel] || [];

  if (pileHistorique.length > 0) {
    const dernierEtat = pileHistorique.pop();
    const poule = poules.value.find(p => p.id === dernierEtat.match.pouleId);
    if (poule && poule.combats) {
      const combat = poule.combats.find(c => c.id === dernierEtat.match.combatId);
      if (combat) {
        combat.statut = 'attente';
        combat.scoreC1 = dernierEtat.ancienScoreC1 || 0;
        combat.scoreC2 = dernierEtat.ancienScoreC2 || 0;
        delete combat.vainqueurDecision;
        poule.termineTimestamp = null;
        poule.prepareMedaille = false;

        await sauvegarderPouleUnique(poule);
      }
      const itemFile = { pouleId: poule.id, nomPoule: poule.nom, combat };
      lancerCombatTable(itemFile, tapisActuel, dernierEtat);
      return;
    }
  }

  const file = getFileAttentePourTapis(tapisActuel);
  if (file.length === 0) return;

  let currentIndex = -1;
  if (matchActif.value) {
    currentIndex = file.findIndex(f => f.pouleId === matchActif.value.pouleId && f.combat.id === matchActif.value.combatId);
  }

  let cible = null;
  if (currentIndex > 0) {
    cible = file[currentIndex - 1];
  } else {
    const termines = file.filter(f => f.combat.statut === 'termine');
    if (termines.length > 0) cible = termines[termines.length - 1];
  }

  if (!cible) {
    alert("Aucun combat précédent trouvé sur cette table.");
    return;
  }

  const pouleCible = poules.value.find(p => p.id === cible.pouleId);
  if (pouleCible && pouleCible.combats) {
    const cb = pouleCible.combats.find(c => c.id === cible.combat.id);
    if (cb) {
      cb.statut = 'attente';
      delete cb.vainqueurDecision;
      pouleCible.termineTimestamp = null;
      pouleCible.prepareMedaille = false;
      await sauvegarderPouleUnique(pouleCible);
    }
  }

  lancerCombatTable(cible, tapisActuel);
};

// Passe au combat suivant en gérant l'étape d'affichage du classement final pour le salut de l'arbitre
const passerAuCombatSuivant = async () => {
  if (!matchActif.value) return;
  const tapisActuel = matchActif.value.tapis;
  const pouleActuelleId = matchActif.value.pouleId;
  const combatActuelId = matchActif.value.combatId;

  const suivant = trouverProchainCombatAlternance(tapisActuel, pouleActuelleId, combatActuelId);

  if (suivant) {
    lancerCombatTable(suivant, tapisActuel);
  } else {
    matchsActifsTables.value[tapisActuel] = null;
    try {
      await set(dbRef(db, `matchsActifs/${tapisActuel}`), null);
    } catch (e) {}
    selectedTapis.value = tapisActuel;
    activeTab.value = 'tables';
  }
};

const validerEtSuivantManuel = async () => {
  if (!matchActif.value) return;
  arreterChrono();
  toketa();

  const tapisActuel = matchActif.value.tapis;
  const poule = poules.value.find(p => p.id === matchActif.value.pouleId);
  if (!poule) return;

  if (pouleEstTerminee(poule)) {
    if (!poule.termineTimestamp) {
      poule.termineTimestamp = Date.now();
      poule.prepareMedaille = false;
      await sauvegarderPouleUnique(poule);
    }
    await passerAuCombatSuivant();
    return;
  }

  const combat = (poule.combats || []).find(c => c.id === matchActif.value.combatId);

  if (!historiqueMatchsTables.value[tapisActuel]) {
    historiqueMatchsTables.value[tapisActuel] = [];
  }
  historiqueMatchsTables.value[tapisActuel].push({
    match: JSON.parse(JSON.stringify(matchActif.value)),
    tempsRestantSecondes: tempsRestant.value,
    ancienScoreC1: combat ? combat.scoreC1 : 0,
    ancienScoreC2: combat ? combat.scoreC2 : 0
  });

  if (combat) {
    if (!matchActif.value.egaliteTotale && !combat.vainqueurDecision) {
      const resScores = calculerScoresClassementCombat(matchActif.value.c1, matchActif.value.c2);
      combat.scoreC1 = resScores.scoreC1;
      combat.scoreC2 = resScores.scoreC2;
      if (resScores.vainqueurDecision) {
        combat.vainqueurDecision = resScores.vainqueurDecision;
      }
    }
    combat.statut = 'termine';

    if (pouleEstTerminee(poule)) {
      poule.termineTimestamp = Date.now();
      poule.prepareMedaille = false;
      await sauvegarderPouleUnique(poule);
      await syncFirebaseMatch();
      return;
    }

    await sauvegarderPouleUnique(poule);
  }

  await passerAuCombatSuivant();
};

// CORRECTIF #5 : Départage FFJudo complet en 4 critères (1. Victoires ➔ 2. Points ➔ 3. Confrontation directe ➔ 4. Poids le plus léger)
const calculerClassementPoule = (poule) => {
  if (!poule || !poule.combattants) return [];
  const combattantsArray = Array.isArray(poule.combattants) ? poule.combattants : Object.values(poule.combattants);
  
  let stats = combattantsArray
    .filter(c => c && !c.horsConcours)
    .map(c => ({ ...c, victoires: 0, points: 0 }));

  const combatsArray = poule.combats ? (Array.isArray(poule.combats) ? poule.combats : Object.values(poule.combats)) : [];
  combatsArray.forEach(cb => {
    if (cb && cb.statut === 'termine') {
      const c1 = combattantsArray.find(x => x && x.numero === cb.c1Num);
      const c2 = combattantsArray.find(x => x && x.numero === cb.c2Num);
      const stat1 = stats.find(x => x.numero === cb.c1Num);
      const stat2 = stats.find(x => x.numero === cb.c2Num);

      const s1 = Number(cb.scoreC1) || 0;
      const s2 = Number(cb.scoreC2) || 0;

      if (cb.vainqueurDecision) {
        if (stat1) {
          stat1.points += s1;
          if (c1?.nomSeul === cb.vainqueurDecision) stat1.victoires++;
        }
        if (stat2) {
          stat2.points += s2;
          if (c2?.nomSeul === cb.vainqueurDecision) stat2.victoires++;
        }
      } else {
        if (stat1) { stat1.points += s1; if (s1 > s2) stat1.victoires++; }
        if (stat2) { stat2.points += s2; if (s2 > s1) stat2.victoires++; }
      }
    }
  });

  return stats.sort((a, b) => {
    if (b.victoires !== a.victoires) return b.victoires - a.victoires;
    if (b.points !== a.points) return b.points - a.points;

    // 3ème critère FFJudo : Confrontation directe entre les deux combattants
    const duelDirect = combatsArray.find(
      cb =>
        cb &&
        cb.statut === 'termine' &&
        ((cb.c1Num === a.numero && cb.c2Num === b.numero) || (cb.c1Num === b.numero && cb.c2Num === a.numero))
    );
    if (duelDirect) {
      if (duelDirect.vainqueurDecision) {
        if (duelDirect.vainqueurDecision === a.nomSeul) return -1;
        if (duelDirect.vainqueurDecision === b.nomSeul) return 1;
      } else {
        const scoreA = duelDirect.c1Num === a.numero ? Number(duelDirect.scoreC1) : Number(duelDirect.scoreC2);
        const scoreB = duelDirect.c1Num === b.numero ? Number(duelDirect.scoreC1) : Number(duelDirect.scoreC2);
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
    }

    // 4ème critère : Le combattant le plus léger à la pesée passe devant
    return (Number(a.poids) || 999) - (Number(b.poids) || 999);
  });
};

const getLibellePlaceJudo = (idx, horsConcours = false) => {
  if (horsConcours) return "1er D'OFFICE (H.C.)";
  if (idx === 0) return '1er';
  if (idx === 1) return '2ème';
  if (idx === 2) return '3ème';
  if (idx === 3) return '3ème Bis';
  if (idx === 4) return '3ème Ter';
  return `3ème (${idx + 1}ème)`;
};

const poulesTerminees = computed(() => {
  const terminees = poules.value.filter(poule => pouleEstTerminee(poule));
  return terminees.sort((a, b) => {
    if (a.prepareMedaille !== b.prepareMedaille) {
      return a.prepareMedaille ? 1 : -1;
    }
    return (a.termineTimestamp || 0) - (b.termineTimestamp || 0);
  });
});

const extraireInfosPoule = (poule) => {
  const premierC = (poule.combattants && poule.combattants[0]) || {};
  const catAge = poule.categorieAge || premierC.categorie || (poule.nom ? poule.nom.split(' ')[0] : 'Catégorie');
  let sexeCode = poule.sexe || premierC.sexe;
  if (!sexeCode) {
    sexeCode = (poule.nom && poule.nom.includes(' F ')) ? 'F' : 'M';
  }
  const sexeLabel = sexeCode === 'F' ? 'Féminin (F)' : 'Masculin (M)';

  let poidsLabel = poule.categoriePoids;
  if (!poidsLabel && poule.combattants && poule.combattants.length > 0) {
    const poidsList = poule.combattants.map(c => Number(c.poids)).filter(Boolean);
    if (poidsList.length > 0) {
      const pMin = Math.min(...poidsList);
      const pMax = Math.max(...poidsList);
      poidsLabel = pMin === pMax ? `${pMin} kg` : `${pMin} à ${pMax} kg`;
    }
  }
  return { catAge, sexeLabel, poidsLabel: poidsLabel || 'Morpho' };
};

const imprimerPoulePodium = (poule) => {
  const classement = calculerClassementPoule(poule);
  const { catAge, sexeLabel, poidsLabel } = extraireInfosPoule(poule);
  const dateDuJour = new Date().toLocaleDateString('fr-FR');
  const horsConcoursList = (poule.combattants || []).filter(c => c && c.horsConcours);

  let fenetreImpression = window.open('', '_blank', 'width=900,height=700');
  if (!fenetreImpression) {
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer le podium.");
    return;
  }
  
  let html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Feuille de Podium - ${poule.nom}</title>
      <style>
        body { font-family: sans-serif; padding: 20px; color: #000; }
        h1, h2, h3 { text-align: center; text-transform: uppercase; margin: 5px 0; }
        .meta-bar { display: flex; justify-content: space-around; border: 2px solid #000; padding: 10px; margin-top: 15px; background: #f8fafc; font-weight: bold; }
        .section-title { margin-top: 25px; font-size: 1.1rem; border-bottom: 2px solid #000; padding-bottom: 5px; font-weight: bold; }
        .table-podium, .table-combats { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table-podium th, .table-podium td, .table-combats th, .table-combats td { border: 2px solid #000; padding: 8px 12px; text-align: center; font-size: 1rem; }
        .table-podium th, .table-combats th { background: #eee; }
        .or { background: #fff3cd !important; font-weight: bold; }
        .argent { background: #e2e3e5 !important; }
        .bronze { background: #f8d7da !important; font-weight: bold; }
        .hc-row { background: #fef2f2 !important; font-style: italic; }
        .footer { margin-top: 35px; display: flex; justify-content: space-between; font-weight: bold; font-size: 0.9rem; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <h2>🥋 TOURNOI GEORGES MAIROT - USPV JUDO</h2>
      <h1>RÉSULTATS OFFICIELS & PODIUM</h1>
      <div class="meta-bar">
        <span>📅 Date : ${dateDuJour}</span>
        <span>🏟️ Tapis : ${poule.tapis || '-'}</span>
        <span>🥋 Âge : ${catAge}</span>
        <span>🚻 Sexe : ${sexeLabel}</span>
        <span>⚖️ Poids : ${poidsLabel}</span>
      </div>
      
      <div class="section-title">🏆 Classement Final & Podium (${poule.nom})</div>
  `;

  if (horsConcoursList.length > 0) {
    html += `
      <p style="margin-top: 10px; font-weight: bold; color: #dc2626;">⭐ Combattants Hors-Concours (1er d'office dans leur catégorie d'origine) :</p>
      <table class="table-podium" style="margin-bottom: 20px;">
        <thead>
          <tr>
            <th>Statut / Médaille</th>
            <th>Nom & Prénom</th>
            <th>Club</th>
            <th>Poids</th>
          </tr>
        </thead>
        <tbody>
    `;
    horsConcoursList.forEach(hc => {
      html += `
        <tr class="hc-row">
          <td><strong>🥇 1er D'OFFICE (H.C.)</strong></td>
          <td><strong>${hc.nomSeul}</strong></td>
          <td>${hc.club}</td>
          <td>${hc.poids} kg</td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
  }

  html += `
      <table class="table-podium">
        <thead>
          <tr>
            <th>Place</th>
            <th>Nom & Prénom</th>
            <th>Club</th>
            <th>Poids</th>
            <th>Victoires</th>
            <th>Points marqués</th>
          </tr>
        </thead>
        <tbody>
  `;

  classement.forEach((c, idx) => {
    let classeLigne = idx === 0 ? 'or' : idx === 1 ? 'argent' : 'bronze';
    const placeLibelle = getLibellePlaceJudo(idx, false);

    html += `
      <tr class="${classeLigne}">
        <td><strong>${placeLibelle}</strong></td>
        <td><strong>${c.nomSeul}</strong></td>
        <td>${c.club}</td>
        <td>${c.poids} kg</td>
        <td>${c.victoires}</td>
        <td>${c.points}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="section-title">⚔️ Détail des Combats de la Poule</div>
      <table class="table-combats">
        <thead>
          <tr>
            <th>N° Combat</th>
            <th>1er Appelé (Rouge)</th>
            <th>Score Rouge</th>
            <th>Score Blanc</th>
            <th>2ème Appelé (Blanc)</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (poule.combats && poule.combats.length > 0) {
    poule.combats.forEach((cb, i) => {
      const c1 = (poule.combattants || []).find(x => x && x.numero === cb.c1Num);
      const c2 = (poule.combattants || []).find(x => x && x.numero === cb.c2Num);
      const mention1 = c1?.horsConcours ? ' (H.C.)' : '';
      const mention2 = c2?.horsConcours ? ' (H.C.)' : '';
      const nomC1 = c1 ? `${c1.nomSeul}${mention1} (${c1.club})` : `C${cb.c1Num}`;
      const nomC2 = c2 ? `${c2.nomSeul}${mention2} (${c2.club})` : `C${cb.c2Num}`;
      const statutTexte = cb.statut === 'termine' ? '✅ Terminé' : '⏳ En attente';
      const scoreAffichageC1 = cb.vainqueurDecision ? (cb.vainqueurDecision === c1?.nomSeul ? `Victoire (${cb.scoreC1 || 0})` : '0') : (cb.scoreC1 !== undefined ? cb.scoreC1 : 0);
      const scoreAffichageC2 = cb.vainqueurDecision ? (cb.vainqueurDecision === c2?.nomSeul ? `Victoire (${cb.scoreC2 || 0})` : '0') : (cb.scoreC2 !== undefined ? cb.scoreC2 : 0);

      html += `
        <tr>
          <td><strong>Combat ${i + 1}</strong></td>
          <td>${nomC1}</td>
          <td><strong>${scoreAffichageC1}</strong></td>
          <td><strong>${scoreAffichageC2}</strong></td>
          <td>${nomC2}</td>
          <td>${statutTexte}</td>
        </tr>
      `;
    });
  } else {
    html += `<tr><td colspan="6" style="text-align:center;">Aucun combat enregistré</td></tr>`;
  }

  html += `
        </tbody>
      </table>
      
      <div class="footer">
        <div>Signature Responsable de Table : ____________________</div>
        <div>Validation Remise des Médailles : ____________________</div>
      </div>
    </body>
    </html>
  `;

  fenetreImpression.document.write(html);
  fenetreImpression.document.close();
};

const imprimerEtValiderMedaille = async (poule) => {
  const index = poules.value.findIndex(p => p.id === poule.id);
  if (index !== -1) {
    poules.value[index].prepareMedaille = true;
    await sauvegarderPouleUnique(poules.value[index]);
  }
  imprimerPoulePodium(poule);
};

const genererHtmlFeuilleTableDeMarque = (poule, dateDuJour) => {
  const { catAge, sexeLabel, poidsLabel } = extraireInfosPoule(poule);
  const combattantsList = poule.combattants || [];
  const N = combattantsList.length;
  const estTerminee = pouleEstTerminee(poule);
  const classement = calculerClassementPoule(poule);

  let html = `
    <div class="sheet-page">
      <div class="header-banner">
        <div class="header-left">
          <div class="tournoi-title">🥋 TOURNOI GEORGES MAIROT — USPV JUDO</div>
          <div class="doc-subtitle">FEUILLE OFFICIELLE DE POULE & TABLE DE MARQUE</div>
        </div>
        <div class="header-right">
          <div class="tapis-badge">TAPIS N° ${poule.tapis || '___'}</div>
          <div class="date-box">📅 Date : <strong>${dateDuJour}</strong></div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">CATÉGORIE D'ÂGE</span><span class="meta-val">${catAge}</span></div>
        <div class="meta-item"><span class="meta-label">SEXE</span><span class="meta-val">${sexeLabel}</span></div>
        <div class="meta-item"><span class="meta-label">CATÉGORIE DE POIDS</span><span class="meta-val">${poidsLabel}</span></div>
        <div class="meta-item"><span class="meta-label">IDENTIFIANT POULE</span><span class="meta-val">${poule.nom}</span></div>
      </div>

      <div class="section-heading">1. TABLEAU DE POULE (GRILLE DES RÉSULTATS CROISÉS - ${N} COMBATTANTS)</div>
      <table class="matrix-table">
        <thead>
          <tr>
            <th style="width: 38px;">N°</th>
            <th style="text-align: left; padding-left: 10px;">NOM & Prénom du Combattant</th>
            <th style="width: 130px;">Club</th>
            <th style="width: 65px;">Poids</th>
  `;

  for (let i = 1; i <= N; i++) {
    html += `<th style="width: 85px;">Combattant<br><span style="font-size:14px; font-weight:900;">N° ${i}</span></th>`;
  }

  html += `
            <th style="width: 80px; background:#e0e7ff !important;">TOTAL<br>VICTOIRES</th>
            <th style="width: 80px; background:#e0e7ff !important;">TOTAL<br>POINTS</th>
            <th style="width: 90px; background:#fef3c7 !important;">CLASSEMENT<br>(PLACE)</th>
          </tr>
        </thead>
        <tbody>
  `;

  combattantsList.forEach((c) => {
    const mentionHC = c.horsConcours ? `<br><span class="hc-badge">⚠️ HORS CONCOURS (1er D'OFFICE)</span>` : '';
    const classeLigneHC = c.horsConcours ? 'background-color: #fef2f2 !important;' : '';

    html += `
      <tr class="matrix-row" style="${classeLigneHC}">
        <td class="num-cell"><strong>${c.numero}</strong></td>
        <td class="name-cell"><strong>${c.nomSeul}</strong>${mentionHC}</td>
        <td class="club-cell">${c.club}</td>
        <td class="weight-cell">${c.poids} kg</td>
    `;

    for (let col = 1; col <= N; col++) {
      if (c.numero === col) {
        html += `<td class="useless-cell"></td>`;
      } else {
        const cb = (poule.combats || []).find(
          x => (x.c1Num === c.numero && x.c2Num === col) || (x.c1Num === col && x.c2Num === c.numero)
        );
        let texteCellule = `<div class="sub-box"><span>V / D</span><span>Pts:</span></div>`;
        if (cb && cb.statut === 'termine') {
          const monScore = cb.c1Num === c.numero ? cb.scoreC1 : cb.scoreC2;
          const sonScore = cb.c1Num === c.numero ? cb.scoreC2 : cb.scoreC1;
          let resLettre = monScore > sonScore ? 'V' : (monScore < sonScore ? 'D' : 'Nul');
          if (cb.vainqueurDecision) {
            resLettre = cb.vainqueurDecision === c.nomSeul ? 'V' : 'D';
          }
          texteCellule = `<div class="filled-score"><strong>${resLettre}</strong><span>${monScore} pts</span></div>`;
        }
        html += `<td class="match-cell">${texteCellule}</td>`;
      }
    }

    const statJoueur = classement.find(x => x.numero === c.numero);
    const idxRank = classement.findIndex(x => x.numero === c.numero);
    const totalVTexte = (estTerminee && statJoueur) ? statJoueur.victoires : '';
    const totalPtsTexte = (estTerminee && statJoueur) ? statJoueur.points : '';
    const placeTexte = c.horsConcours ? 'H.C. (1er)' : ((estTerminee && idxRank !== -1) ? getLibellePlaceJudo(idxRank, false) : '');

    html += `
        <td class="total-cell">${totalVTexte}</td>
        <td class="total-cell">${totalPtsTexte}</td>
        <td class="rank-cell" style="font-size: 13px;">${placeTexte}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>

      <div class="section-heading" style="margin-top: 10px;">
        2. ORDRE OFFICIEL DES COMBATS & MARQUAGE (IPPON = 10 pts | WAZA-ARI = 7 pts | YUKO = 1 pt)
      </div>
      <table class="fights-table">
        <thead>
          <tr>
            <th style="width: 50px;">Combat</th>
            <th style="width: 230px;">🟥 1er APPELÉ (ROUGE)</th>
            <th style="width: 125px;">Points ROUGE<br><span style="font-size:9px; font-weight:normal;">(I / W / Y / Shido)</span></th>
            <th style="width: 35px;">VS</th>
            <th style="width: 125px;">Points BLANC<br><span style="font-size:9px; font-weight:normal;">(I / W / Y / Shido)</span></th>
            <th style="width: 230px;">🥋 2ème APPELÉ (BLANC)</th>
            <th>VAINQUEUR DU COMBAT<br><span style="font-size:9px; font-weight:normal;">(Entourer ou écrire le nom)</span></th>
          </tr>
        </thead>
        <tbody>
  `;

  if (poule.combats && poule.combats.length > 0) {
    poule.combats.forEach((cb, idx) => {
      const c1 = combattantsList.find(x => x.numero === cb.c1Num);
      const c2 = combattantsList.find(x => x.numero === cb.c2Num);
      const mention1 = c1?.horsConcours ? ' (H.C.)' : '';
      const mention2 = c2?.horsConcours ? ' (H.C.)' : '';
      const nomC1 = c1 ? `<strong>#${c1.numero} ${c1.nomSeul}</strong>${mention1} <span class="mini-club">(${c1.club})</span>` : `#${cb.c1Num}`;
      const nomC2 = c2 ? `<strong>#${c2.numero} ${c2.nomSeul}</strong>${mention2} <span class="mini-club">(${c2.club})</span>` : `#${cb.c2Num}`;

      const score1 = cb.statut === 'termine' ? `<strong>${cb.scoreC1} pts</strong>` : `<span class="score-guides">I:__ W:__ Y:__ S:__</span>`;
      const score2 = cb.statut === 'termine' ? `<strong>${cb.scoreC2} pts</strong>` : `<span class="score-guides">I:__ W:__ Y:__ S:__</span>`;

      let vainqueurTexte = '';
      if (cb.statut === 'termine') {
        if (cb.vainqueurDecision) vainqueurTexte = `<strong>${cb.vainqueurDecision}</strong>`;
        else if (cb.scoreC1 > cb.scoreC2) vainqueurTexte = `<strong>${c1 ? c1.nomSeul : ''}</strong>`;
        else if (cb.scoreC2 > cb.scoreC1) vainqueurTexte = `<strong>${c2 ? c2.nomSeul : ''}</strong>`;
        else vainqueurTexte = `<strong>Égalité</strong>`;
      }

      html += `
        <tr>
          <td style="font-weight:bold; background:#f8fafc !important;">N° ${idx + 1}</td>
          <td style="text-align:left; padding-left:8px; font-size:12px;">${nomC1}</td>
          <td>${score1}</td>
          <td style="font-weight:bold; color:#64748b;">VS</td>
          <td>${score2}</td>
          <td style="text-align:left; padding-left:8px; font-size:12px;">${nomC2}</td>
          <td>${vainqueurTexte}</td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>

      <div class="sheet-footer">
        <div>Signature Arbitre / Commissaire Sportif : ___________________________</div>
        <div>Remise des Médailles effectuée : [ &nbsp; ] OUI &nbsp;&nbsp; [ &nbsp; ] NON</div>
      </div>
    </div>
  `;

  return html;
};

const getStylesFeuilleTableDeMarque = () => `
  @page { size: A4 landscape; margin: 8mm; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; font-size: 12px; }
  .sheet-page { page-break-after: always; padding: 2px; box-sizing: border-box; }
  .sheet-page:last-child { page-break-after: auto; }
  
  .header-banner { display: flex; justify-content: space-between; align-items: center; border: 2.5px solid #000; padding: 6px 14px; background: #f1f5f9 !important; border-radius: 6px; }
  .tournoi-title { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
  .doc-subtitle { font-size: 11px; font-weight: bold; color: #334155; }
  .header-right { text-align: right; display: flex; align-items: center; gap: 15px; }
  .tapis-badge { background: #000 !important; color: #fff !important; font-size: 16px; font-weight: 900; padding: 5px 14px; border-radius: 4px; }
  .date-box { font-size: 12px; }

  .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px; }
  .meta-item { border: 2px solid #000; padding: 4px 10px; border-radius: 4px; background: #fff !important; }
  .meta-label { display: block; font-size: 9px; font-weight: bold; color: #475569; text-transform: uppercase; }
  .meta-val { font-size: 14px; font-weight: 900; color: #000; }

  .section-heading { font-size: 11px; font-weight: 900; text-transform: uppercase; background: #0f172a !important; color: #fff !important; padding: 5px 10px; margin-top: 8px; border-radius: 4px 4px 0 0; }
  
  .matrix-table { width: 100%; border-collapse: collapse; border: 2.5px solid #000; }
  .matrix-table th, .matrix-table td { border: 1.5px solid #000; padding: 6px; text-align: center; }
  .matrix-table th { background: #e2e8f0 !important; font-size: 11px; text-transform: uppercase; height: 34px; }
  .matrix-row { height: 56px; }
  .num-cell { font-size: 18px; background: #f8fafc !important; }
  .name-cell { text-align: left !important; padding-left: 10px !important; font-size: 15px; }
  .club-cell { font-size: 12px; font-weight: bold; }
  .weight-cell { font-family: monospace; font-size: 14px; font-weight: bold; }
  .hc-badge { color: #dc2626; font-size: 10px; font-weight: 900; background: #fee2e2; padding: 1px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; }

  .useless-cell {
    background-color: #94a3b8 !important;
    background-image: repeating-linear-gradient(
      45deg,
      #94a3b8,
      #94a3b8 6px,
      #64748b 6px,
      #64748b 12px
    ) !important;
  }

  .match-cell { vertical-align: middle; background: #fff !important; }
  .sub-box { display: flex; flex-direction: column; justify-content: space-between; font-size: 10px; color: #94a3b8; height: 44px; text-align: left; padding: 2px 4px; }
  .filled-score { display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 14px; }
  .total-cell { background: #f8fafc !important; font-size: 16px; font-weight: bold; }
  .rank-cell { background: #fffbeb !important; font-size: 14px; font-weight: 900; }

  .fights-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
  .fights-table th, .fights-table td { border: 1.5px solid #000; padding: 4px 6px; text-align: center; }
  .fights-table th { background: #e2e8f0 !important; font-size: 10px; text-transform: uppercase; }
  .fights-table td { height: 26px; }
  .mini-club { font-size: 10px; color: #475569; text-transform: uppercase; }
  .score-guides { font-size: 10px; color: #64748b; letter-spacing: 0.5px; }
  .sheet-footer { margin-top: 8px; display: flex; justify-content: space-between; font-weight: bold; font-size: 11px; padding-top: 4px; }
`;

const imprimerFeuillesTapisGlobal = (tapisUnique = null) => {
  const listeAImprimer = tapisUnique 
    ? poules.value.filter(p => Number(p.tapis) === Number(tapisUnique))
    : [...poules.value].sort((a, b) => Number(a.tapis) - Number(b.tapis));

  if (listeAImprimer.length === 0) {
    alert("Aucune poule à imprimer !");
    return;
  }

  const dateDuJour = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let fenetreImpression = window.open('', '_blank', 'width=1100,height=800');
  if (!fenetreImpression) return;
  let html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Tableaux de Combat Officiels - Tournoi Judo</title>
      <style>${getStylesFeuilleTableDeMarque()}</style>
    </head>
    <body onload="window.print(); window.close();">
  `;

  listeAImprimer.forEach(poule => {
    html += genererHtmlFeuilleTableDeMarque(poule, dateDuJour);
  });

  html += `</body></html>`;
  fenetreImpression.document.write(html);
  fenetreImpression.document.close();
};

const resultatRechercheParent = computed(() => {
  const recherche = (rechercheNomParent.value || '').trim().toUpperCase();
  if (!recherche || recherche.length < 2) return [];
  let resultats = [];
  (poules.value || []).forEach(poule => {
    if (!poule || !poule.combattants) return;
    const combattantsList = Array.isArray(poule.combattants) ? poule.combattants : Object.values(poule.combattants);
    combattantsList.forEach(c => {
      if (c && c.nomSeul && c.nomSeul.toUpperCase().includes(recherche)) {
        const classement = calculerClassementPoule(poule);
        const info = classement.find(x => x.numero === c.numero);
        const idx = classement.findIndex(x => x.numero === c.numero);
        const placeLibelle = c.horsConcours 
          ? "1er d'office (H.C.)" 
          : (idx !== -1 ? getLibellePlaceJudo(idx, false) : '-');

        resultats.push({
          combattant: c,
          poule: poule,
          tapis: Number(poule.tapis) || 0,
          victoires: info?.victoires || 0,
          points: info?.points || 0,
          placeLibelle: placeLibelle
        });
      }
    });
  });
  return resultats;
});
</script>

<template>
  <!-- ================= 1. VUE ÉCRAN DÉPORTÉ / PUBLIC DU COMBAT (100% AUTO-ADAPTATIF SANS SCROLL) ================= -->
  <div v-if="modeEcranCombat" class="h-screen w-screen bg-black text-white flex flex-col justify-between p-[1.5vh] px-[2vw] font-sans relative overflow-hidden select-none gap-[1.2vh]">
    
    <!-- Animation IPPON géante en plein écran -->
    <div v-if="afficherIpponAnimation" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-black/60">
      <h1 class="text-[18vw] font-black tracking-widest text-amber-400 drop-shadow-[0_0_50px_rgba(255,193,7,0.8)] animate-ippon-slide uppercase">
        IPPON
      </h1>
    </div>

    <!-- Animation HANSOKU-MAKE (Disqualification) en plein écran -->
    <div v-if="afficherHansokuAnimation" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden bg-red-950/85">
      <h1 class="text-[8vw] font-black tracking-wider text-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,0.9)] animate-ippon-slide uppercase text-center px-4">
        HANSOKU-MAKE (ÉLIMINATION)
      </h1>
    </div>

    <!-- En-tête (Hauteur compacte proportionnelle + Bouton discret Plein Écran) -->
    <div @dblclick="basculerPleinEcran" class="shrink-0 bg-zinc-900 border-2 border-zinc-700 px-[2vw] py-[1.2vh] rounded-2xl flex justify-between items-center z-10 shadow-xl">
      <span class="font-black text-amber-400" style="font-size: clamp(1.2rem, 2.6vh, 2.5rem);">🥋 TAPIS {{ selectedTapis }}</span>
      <span class="font-black tracking-widest text-white uppercase truncate px-4" style="font-size: clamp(1.4rem, 3.2vh, 3.2rem);">{{ formaterTitrePouleTV(matchActif?.nomPoule) }}</span>
      <div class="flex items-center gap-3">
        <span class="text-zinc-400 font-bold hidden md:inline" style="font-size: clamp(0.85rem, 1.8vh, 1.4rem);">TOURNOI GEORGES MAIROT</span>
        <button
          @click="basculerPleinEcran"
          class="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 px-2.5 py-1 rounded-xl text-xs font-bold transition opacity-60 hover:opacity-100"
          title="Basculer en mode Plein Écran (ou double-cliquez sur cette barre)"
        >
          {{ estPleinEcran ? '✕ Quitter' : '⛶ Plein Écran' }}
        </button>
      </div>
    </div>

    <!-- 🏆 ÉCRAN DE CLASSEMENT FINAL AUTOMATIQUE LORSQUE LA POULE EST TERMINÉE (POUR LE SALUT DE L'ARBITRE) -->
    <div v-if="matchActif && pouleDuMatchActifEstTerminee && !afficherIpponAnimation && !afficherHansokuAnimation" class="flex-1 min-h-0 flex flex-col items-center justify-center bg-zinc-900/95 border-4 border-amber-400 p-[2vh] px-[3vw] rounded-3xl z-30 shadow-2xl space-y-[1.8vh] overflow-hidden">
      <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="confetti c1"></div><div class="confetti c2"></div><div class="confetti c3"></div>
        <div class="confetti c4"></div><div class="confetti c5"></div><div class="confetti c6"></div>
      </div>
      
      <div class="text-center z-10 shrink-0">
        <span class="bg-amber-400 text-black font-black px-4 py-1 rounded-full uppercase tracking-widest" style="font-size: clamp(0.8rem, 1.8vh, 1.3rem);">
          🥋 FIN DE LA POULE — SALUT OFFICIEL & CLASSEMENT
        </span>
        <h2 class="font-black text-white mt-1 uppercase" style="font-size: clamp(1.6rem, 4.2vh, 3.6rem);">{{ formaterTitrePouleTV(matchActif.nomPoule) }}</h2>
      </div>

      <!-- Combattants Hors-Concours éventuels -->
      <div v-if="(pouleDuMatchActif?.combattants || []).some(c => c.horsConcours)" class="w-full max-w-5xl z-10 shrink-0">
        <div v-for="hc in (pouleDuMatchActif?.combattants || []).filter(c => c.horsConcours)" :key="hc.idUnique" class="bg-red-950/80 border-2 border-red-500 px-5 py-2 rounded-2xl flex justify-between items-center">
          <span class="font-black text-amber-300" style="font-size: clamp(1.1rem, 2.5vh, 2rem);">🥇 1er D'OFFICE (H.C.) — {{ hc.nomSeul }} ({{ hc.club }})</span>
          <span class="text-red-200 font-bold text-sm">Hors-Concours</span>
        </div>
      </div>

      <!-- Liste auto-adaptative du Podium -->
      <div class="w-full max-w-5xl flex-1 min-h-0 flex flex-col justify-center gap-[1.2vh] z-10">
        <div
          v-for="(c, idx) in calculerClassementPoule(pouleDuMatchActif)"
          :key="idx"
          :class="idx === 0 ? 'bg-amber-500/20 border-amber-400 text-amber-300' : (idx === 1 ? 'bg-zinc-800 border-zinc-500 text-zinc-200' : 'bg-orange-950/60 border-orange-500 text-orange-200')"
          class="flex-1 min-h-0 px-[2vw] py-[1vh] rounded-2xl border-4 flex justify-between items-center shadow-lg"
        >
          <div class="flex items-center gap-4 min-w-0">
            <span style="font-size: clamp(1.8rem, 4.5vh, 3.5rem);">{{ idx === 0 ? '🥇' : (idx === 1 ? '🥈' : '🥉') }}</span>
            <div class="truncate">
              <span class="font-black block text-white truncate" style="font-size: clamp(1.4rem, 3.8vh, 3rem);">{{ getLibellePlaceJudo(idx) }} — {{ c.nomSeul }}</span>
              <span class="font-bold uppercase tracking-wider opacity-90 block truncate" style="font-size: clamp(0.9rem, 2vh, 1.5rem);">{{ c.club }} • {{ c.poids }} kg</span>
            </div>
          </div>
          <div class="text-right shrink-0 ml-4">
            <span class="font-black block text-emerald-400" style="font-size: clamp(1.2rem, 3vh, 2.4rem);">{{ c.victoires }} victoire(s)</span>
            <span class="font-mono opacity-80 block" style="font-size: clamp(0.85rem, 1.8vh, 1.3rem);">{{ c.points }} pts</span>
          </div>
        </div>
      </div>

      <p class="text-amber-300 font-bold animate-pulse z-10 text-center shrink-0" style="font-size: clamp(0.95rem, 2.2vh, 1.6rem);">
        🥋 Salut de fin de poule par l'arbitre — Classement transmis à la Table des Médailles
      </p>
    </div>

    <!-- BANDEAU VAINQUEUR GÉANT (POUR LES COMBATS INTERMÉDIAIRES DE LA POULE) -->
    <div v-else-if="matchActif?.vainqueur && !afficherIpponAnimation && !afficherHansokuAnimation" class="absolute inset-0 bg-black flex flex-col items-center justify-center p-8 z-20 text-center space-y-[3vh]">
      <div class="absolute inset-0 pointer-events-none overflow-hidden" v-if="!matchActif.egaliteTotale">
        <div class="confetti c1"></div><div class="confetti c2"></div><div class="confetti c3"></div>
        <div class="confetti c4"></div><div class="confetti c5"></div><div class="confetti c6"></div>
      </div>
      <span class="font-black uppercase tracking-widest text-amber-400 animate-bounce" style="font-size: clamp(1.8rem, 4.5vh, 4rem);">
        {{ matchActif.egaliteTotale && matchActif.clubVainqueur === 'ÉGALITÉ' ? '🤝 MATCH NUL 🤝' : '🏆 VAINQUEUR DU COMBAT 🏆' }}
      </span>
      <h1 class="font-black text-white drop-shadow-[0_20px_40px_rgba(255,255,255,0.2)]" style="font-size: clamp(3rem, 10vh, 9rem);">{{ matchActif.vainqueur }}</h1>
      <p class="font-black text-amber-300 tracking-wider uppercase drop-shadow-[0_15px_30px_rgba(255,193,7,0.3)] border-t-4 border-amber-400/50 pt-[2vh] px-12" style="font-size: clamp(2rem, 6vh, 5rem);">{{ matchActif.clubVainqueur }}</p>
      <p class="text-zinc-400 animate-pulse font-bold" style="font-size: clamp(1.2rem, 3vh, 2.5rem);">En attente du prochain combat...</p>
    </div>

    <!-- ZONE CENTRALE FLEXIBLE DES 2 COMBATTANTS (Uniquement ROUGE et BLANC, sans Haut/Bas) -->
    <div v-else-if="matchActif" class="flex-1 min-h-0 flex flex-col gap-[1.2vh] w-full z-10">
      
      <!-- Combattant 1 (ROUGE) -->
      <div class="flex-1 min-h-0 bg-zinc-900 border-4 md:border-8 border-red-600 px-[2vw] py-[1vh] rounded-3xl shadow-2xl flex flex-row justify-between items-center gap-[2vw]">
        <div class="flex flex-col justify-center flex-1 min-w-0 space-y-[0.5vh]">
          <div class="flex items-center gap-3">
            <span class="bg-red-600 text-white px-4 py-0.5 rounded-full font-black uppercase tracking-wider" style="font-size: clamp(0.75rem, 1.8vh, 1.25rem);">🟥 ROUGE (#{{ matchActif.c1.numero }})</span>
            <div class="flex items-center gap-2" v-if="matchActif.c1.shido > 0">
              <span v-for="s in matchActif.c1.shido" :key="s" :class="s === 3 ? 'carton-rouge-tv' : 'carton-jaune-tv'"></span>
            </div>
          </div>
          <h2 class="font-black tracking-wide text-white truncate leading-tight" style="font-size: clamp(1.8rem, 5.5vh, 4.8rem);">{{ matchActif.c1.nom }}</h2>
          <p class="font-bold text-red-300 tracking-wide uppercase truncate" style="font-size: clamp(1rem, 2.6vh, 2.2rem);">{{ matchActif.c1.club }}</p>
        </div>

        <div class="grid grid-cols-3 gap-[1vw] h-full max-h-[22vh] items-stretch shrink-0 py-[0.4vh]">
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-emerald-500/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <span class="font-black tracking-widest text-emerald-300 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">IPPON</span>
            <span class="leading-none font-black text-emerald-400" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c1.ippon }}</span>
          </div>
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-blue-500/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(59,130,246,0.25)]">
            <span class="font-black tracking-widest text-blue-300 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">WAZA-ARI</span>
            <span class="leading-none font-black text-blue-400" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c1.waza }}</span>
          </div>
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-amber-400/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(251,191,36,0.25)]">
            <span class="font-black tracking-widest text-amber-200 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">YUKO</span>
            <span class="leading-none font-black text-amber-300" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c1.yuko }}</span>
          </div>
        </div>
      </div>

      <!-- Combattant 2 (BLANC) -->
      <div class="flex-1 min-h-0 bg-zinc-900 border-4 md:border-8 border-indigo-600 px-[2vw] py-[1vh] rounded-3xl shadow-2xl flex flex-row justify-between items-center gap-[2vw]">
        <div class="flex flex-col justify-center flex-1 min-w-0 space-y-[0.5vh]">
          <div class="flex items-center gap-3">
            <span class="bg-indigo-600 text-white px-4 py-0.5 rounded-full font-black uppercase tracking-wider" style="font-size: clamp(0.75rem, 1.8vh, 1.25rem);">⬜ BLANC (#{{ matchActif.c2.numero }})</span>
            <div class="flex items-center gap-2" v-if="matchActif.c2.shido > 0">
              <span v-for="s in matchActif.c2.shido" :key="s" :class="s === 3 ? 'carton-rouge-tv' : 'carton-jaune-tv'"></span>
            </div>
          </div>
          <h2 class="font-black tracking-wide text-white truncate leading-tight" style="font-size: clamp(1.8rem, 5.5vh, 4.8rem);">{{ matchActif.c2.nom }}</h2>
          <p class="font-bold text-indigo-300 tracking-wide uppercase truncate" style="font-size: clamp(1rem, 2.6vh, 2.2rem);">{{ matchActif.c2.club }}</p>
        </div>

        <div class="grid grid-cols-3 gap-[1vw] h-full max-h-[22vh] items-stretch shrink-0 py-[0.4vh]">
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-emerald-500/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <span class="font-black tracking-widest text-emerald-300 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">IPPON</span>
            <span class="leading-none font-black text-emerald-400" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c2.ippon }}</span>
          </div>
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-blue-500/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(59,130,246,0.25)]">
            <span class="font-black tracking-widest text-blue-300 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">WAZA-ARI</span>
            <span class="leading-none font-black text-blue-400" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c2.waza }}</span>
          </div>
          <div class="bg-black px-[1.8vw] rounded-2xl border-4 border-amber-400/80 flex flex-col justify-center items-center min-w-[9vw] shadow-[0_0_20px_rgba(251,191,36,0.25)]">
            <span class="font-black tracking-widest text-amber-200 uppercase" style="font-size: clamp(0.7rem, 1.6vh, 1.2rem);">YUKO</span>
            <span class="leading-none font-black text-amber-300" style="font-size: clamp(2.8rem, 11vh, 8.5rem);">{{ matchActif.c2.yuko }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center text-center text-zinc-500 z-10 font-bold" style="font-size: clamp(1.5rem, 4vh, 3rem);">
      Aucun combat actif sur ce tapis pour le moment...
    </div>

    <!-- ZONE BASSE : CHRONOMÈTRE + JAUGE OSAEKOMI CALIBRÉE AU DIXIÈME DE SECONDE -->
    <div class="shrink-0 grid gap-[1.2vh] z-10" :class="matchActif?.osaekomiActif ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'">
      
      <!-- CHRONOMÈTRE PRINCIPAL GÉANT -->
      <div class="bg-zinc-900 border-4 border-zinc-800 py-[1vh] px-[2vw] rounded-3xl shadow-2xl flex items-center justify-center">
        <div class="leading-none font-black font-mono tracking-widest text-amber-400 drop-shadow-[0_10px_20px_rgba(255,193,7,0.3)]" style="font-size: clamp(3.5rem, 12vh, 9.5rem);">
          {{ matchActif?.tempsRestant || '03:00' }}
        </div>
      </div>

      <!-- JAUGE OSAEKOMI SUR L'ÉCRAN DÉPORTÉ (CALIBRÉE EXACTEMENT SUR 7s/15s OU 10s/20s) -->
      <div v-if="matchActif?.osaekomiActif" class="bg-zinc-900 border-4 border-amber-400 px-[1.5vw] py-[1vh] rounded-3xl shadow-2xl flex flex-col justify-center space-y-[0.8vh]">
        <div class="flex justify-between items-center px-1">
          <span class="font-black text-amber-400 uppercase tracking-wide flex items-center gap-2" style="font-size: clamp(1rem, 2.5vh, 2rem);">
            ⏱️ OSAEKOMI — {{ matchActif.osaekomiCombattant === 1 ? '🟥 ROUGE' : '⬜ BLANC' }}
            <span v-if="tempsOsaeAffiche >= seuilWazaCourant" class="bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-full animate-bounce">
              WAZA-ARI ACQUIS !
            </span>
          </span>
          <span class="font-black font-mono text-white leading-none" style="font-size: clamp(1.5rem, 4vh, 3.2rem);">
            {{ tempsOsaeAffiche }}s <span class="text-zinc-500" style="font-size: clamp(1rem, 2.2vh, 1.8rem);">/ {{ seuilIpponCourant }}s</span>
          </span>
        </div>

        <!-- Barre de jauge progressive avec ligne de seuil exacte (border-l-4 pile à 46.67% pour 7s/15s ou 50% pour 10s/20s) -->
        <div class="relative w-full h-[4.5vh] min-h-[30px] max-h-[48px] bg-zinc-950 rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-inner">
          <div
            class="h-full transition-all duration-150 ease-linear"
            :class="tempsOsaeAffiche >= seuilWazaCourant ? 'bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'"
            :style="{ width: pourcentageJaugeOsae + '%' }"
          ></div>

          <!-- Marqueur exact Waza-ari (la bordure gauche border-l-4 marque le point mathématique exact de 7s ou 10s) -->
          <div
            class="absolute top-0 bottom-0 border-l-4 border-dashed border-white z-10 flex items-center"
            :style="{ left: positionMarqueurWaza + '%' }"
          >
            <span class="bg-black/85 text-white text-[11px] font-black px-2 py-0.5 rounded ml-1.5 uppercase tracking-wider shadow">
              Waza-ari ({{ seuilWazaCourant }}s)
            </span>
          </div>

          <!-- Repère Ippon à droite -->
          <div class="absolute right-2 top-0 bottom-0 flex items-center z-10">
            <span class="bg-black/85 text-emerald-400 text-[11px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow">
              Ippon ({{ seuilIpponCourant }}s)
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- À SUIVRE -->
    <div class="shrink-0 bg-zinc-900 border-2 border-indigo-500 px-[2vw] py-[1vh] rounded-2xl flex flex-wrap items-center justify-center gap-3 shadow-2xl z-10">
      <span class="font-black text-indigo-400 uppercase tracking-widest" style="font-size: clamp(0.75rem, 1.7vh, 1.1rem);">⏳ À SUIVRE / SE PRÉPARE :</span>
      <span class="font-black text-white tracking-wide truncate" style="font-size: clamp(1rem, 2.4vh, 1.9rem);">{{ matchActif?.prochainCombat || '---' }}</span>
    </div>
  </div>

  <!-- ================= 2. VUE PUBLIQUE STRICTE POUR LES PARENTS (QR CODE) ================= -->
  <div v-else-if="modePublic" class="min-h-screen bg-slate-900 text-white p-4 sm:p-6 font-sans">
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="text-center bg-indigo-950 p-6 rounded-3xl border border-indigo-800 shadow-xl">
        <h1 class="text-2xl sm:text-3xl font-black text-amber-400 mb-1">🥋 TOURNOI GEORGES MAIROT</h1>
        <p class="text-indigo-300 text-sm">Suivi en direct de votre enfant — USPV Judo</p>
      </div>

      <div v-if="!qrCodeActif" class="bg-amber-950/80 border-2 border-amber-500 p-8 rounded-3xl text-center space-y-3">
        <span class="text-5xl block">⏳</span>
        <h2 class="text-2xl font-bold text-amber-300">Accès public temporairement désactivé</h2>
        <p class="text-sm text-amber-200">Le suivi en direct des résultats sera activé par l'organisation au début du tournoi. Merci de patienter !</p>
      </div>

      <template v-else>
        <div class="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-lg">
          <label class="block text-sm font-semibold text-slate-300 mb-2">Entrez le Nom ou Prénom de votre enfant :</label>
          <input v-model="rechercheNomParent" type="text" class="w-full p-4 bg-slate-900 border-2 border-indigo-600 rounded-2xl font-bold text-xl text-white outline-none uppercase placeholder:text-slate-600" placeholder="ex: DUPONT..." />
        </div>

        <div v-if="resultatRechercheParent.length > 0" class="space-y-4">
          <div v-for="(res, idx) in resultatRechercheParent" :key="idx" class="bg-slate-800 border-2 border-indigo-500 p-6 rounded-3xl shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-slate-700 pb-3 gap-2">
              <div>
                <h2 class="text-2xl font-black text-amber-400">{{ res.combattant.nomSeul }}</h2>
                <p class="text-xs text-slate-400 mt-0.5">Club : <span class="font-bold text-white">{{ res.combattant.club }}</span> • Poule : <span class="font-bold text-white">{{ formaterTitrePouleTV(res.poule.nom) }}</span></p>
              </div>
              <div v-if="res.tapis > 0" class="bg-indigo-600 text-white font-black px-4 py-2 rounded-2xl text-lg shadow shrink-0">
                Tapis {{ res.tapis }}
              </div>
              <div v-else class="bg-amber-500 text-black font-black px-3 py-2 rounded-2xl text-xs shadow shrink-0 uppercase">
                📢 En Chambre d'Appel
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="bg-slate-900 p-3 rounded-2xl border border-slate-700"><span class="block text-xs text-slate-400">Victoires</span><span class="text-xl font-bold text-emerald-400">{{ res.victoires }}</span></div>
              <div class="bg-slate-900 p-3 rounded-2xl border border-slate-700"><span class="block text-xs text-slate-400">Points</span><span class="text-xl font-bold text-blue-400">{{ res.points }}</span></div>
              <div class="bg-slate-900 p-3 rounded-2xl border border-slate-700"><span class="block text-xs text-slate-400">Classement</span><span class="text-xl font-bold text-amber-400">{{ res.placeLibelle }}</span></div>
            </div>
          </div>
        </div>

        <div v-else-if="rechercheNomParent.trim().length >= 2" class="bg-slate-800/60 p-6 rounded-3xl border border-slate-700 text-center text-slate-300">
          Aucun combattant trouvé pour « <strong>{{ rechercheNomParent }}</strong> » dans les poules générées.
        </div>
      </template>
    </div>
  </div>

  <!-- ================= 3. VUE ORGANISATION (PC PORTABLE, TABLETTE & MOBILE) ================= -->
  <div v-else class="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12">
    
    <!-- ÉCRAN DE VERROUILLAGE SÉCURISÉ PAR MOT DE PASSE -->
    <div v-if="adminVerrouille" class="min-h-screen bg-slate-900 flex items-center justify-center p-6 print:hidden">
      <div class="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full text-center space-y-6">
        <div class="text-5xl">🔐</div>
        <h2 class="text-2xl font-black text-white">Espace Organisation Sécurisé</h2>
        <p class="text-sm text-slate-400">Veuillez entrer le mot de passe de l'organisation pour accéder aux tables, au poste Speaker et à la pesée.</p>
        
        <form @submit.prevent="verifierMotDePasse" class="space-y-4">
          <input v-model="motDepasseSaisi" type="password" placeholder="Mot de passe..." class="w-full p-4 bg-slate-900 border-2 border-indigo-600 rounded-2xl font-bold text-center text-xl text-white outline-none focus:border-emerald-500 transition" autofocus />
          <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg transition text-lg">
            🔓 Déverrouiller
          </button>
        </form>

        <p v-if="erreurMotDePasse" class="text-red-400 font-bold text-sm">❌ Mot de passe incorrect. Réessayez.</p>
        
        <div class="pt-4 border-t border-slate-700">
          <a :href="urlAppPublic" class="text-xs text-indigo-400 hover:underline">← Retourner vers l'accès public (Parents)</a>
        </div>
      </div>
    </div>

    <!-- CONTENU DE L'ORGANISATION -->
    <template v-else>
      <header class="bg-indigo-900 text-white shadow-md p-3 sm:p-4 flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <h1 class="text-base sm:text-xl font-bold tracking-wide">🥋 TOURNOI DE JUDO — ESPACE ORGANISATION</h1>
          <p class="text-xs text-indigo-200 mt-0.5">État : {{ statutConnexion }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-end">
          <button @click="adminVerrouille = true" class="bg-red-700 hover:bg-red-800 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow" title="Verrouiller l'accès de l'espace administration">
            🔒 Verrouiller
          </button>
          <nav class="flex flex-wrap gap-1.5 sm:gap-2">
            <button @click="activeTab = 'pesee'" :class="activeTab === 'pesee' ? 'bg-indigo-600 ring-2 ring-amber-400' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-2.5 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition">
              ⚖️ Pesée
            </button>
            <button @click="activeTab = 'appel'" :class="activeTab === 'appel' ? 'bg-amber-500 text-black ring-2 ring-white' : 'bg-indigo-800 hover:bg-indigo-700 text-amber-300'" class="px-2.5 sm:px-3 py-2 rounded-lg font-black text-xs sm:text-sm transition flex items-center gap-1.5">
              <span>📢 Appel & Speaker</span>
              <span v-if="poulesEnAttenteAppel.length > 0" class="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                {{ poulesEnAttenteAppel.length }}
              </span>
            </button>
            <button @click="activeTab = 'tables'" :class="activeTab === 'tables' ? 'bg-indigo-600 ring-2 ring-amber-400' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-2.5 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition">
              🏟️ Tables (Tapis)
            </button>
            <button @click="activeTab = 'medailles'" :class="activeTab === 'medailles' ? 'bg-indigo-600 ring-2 ring-amber-400' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-2.5 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition">
              🥇 Médailles
            </button>
            <button @click="activeTab = 'tv'" :class="activeTab === 'tv' ? 'bg-indigo-600 ring-2 ring-amber-400' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-2.5 sm:px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition">
              📺 TV & QR
            </button>
          </nav>
        </div>
      </header>

      <main class="p-3 sm:p-6 w-full max-w-none">
        <div v-if="erreurMessage" class="mb-6 p-4 bg-red-100 border border-red-400 text-red-800 rounded-lg font-semibold print:hidden">
          ⚠️ {{ erreurMessage }}
        </div>

        <!-- MODAL D'AJOUT D'UN COMBATTANT RETARDATAIRE DEPUIS LA CHAMBRE D'APPEL -->
        <div v-if="pouleEnAjoutRetardataire" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 print:hidden">
          <div class="bg-white p-6 rounded-3xl shadow-2xl max-w-lg w-full space-y-4 border-2 border-indigo-600">
            <div class="flex justify-between items-center border-b pb-3">
              <h3 class="font-black text-lg text-indigo-950">➕ Ajouter un retardataire à "{{ pouleEnAjoutRetardataire.nom }}"</h3>
              <button @click="pouleEnAjoutRetardataire = null" class="text-slate-400 hover:text-slate-700 font-bold text-lg">✕</button>
            </div>

            <div class="flex gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                @click="modeRetardataireExistant = true"
                :class="modeRetardataireExistant ? 'bg-indigo-600 text-white' : 'text-slate-700'"
                class="flex-1 py-2 rounded-lg font-bold text-xs transition"
              >
                Choisir dans les pesés en attente
              </button>
              <button
                type="button"
                @click="modeRetardataireExistant = false"
                :class="!modeRetardataireExistant ? 'bg-indigo-600 text-white' : 'text-slate-700'"
                class="flex-1 py-2 rounded-lg font-bold text-xs transition"
              >
                Créer un nouveau retardataire
              </button>
            </div>

            <div v-if="modeRetardataireExistant" class="space-y-3">
              <label class="block text-xs font-bold text-slate-700 uppercase">Sélectionnez le judoka présent :</label>
              <select v-model="judokaSelectionnePourPoule" class="w-full p-3 border-2 border-indigo-300 rounded-xl text-sm font-bold bg-white">
                <option value="">-- Choisir un judoka pesé --</option>
                <option v-for="j in judokasDisponiblesPourRetardataire" :key="j.id" :value="j.id">
                  {{ j.nom }} ({{ j.club }} • {{ j.categorie }} • {{ j.poids }} kg)
                </option>
              </select>
              <p v-if="judokasDisponiblesPourRetardataire.length === 0" class="text-xs text-amber-600 italic">
                Aucun judoka pesé disponible (tous sont déjà dans une poule). Créez-en un nouveau ci-dessus.
              </p>
            </div>

            <div v-else class="space-y-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase">Nom & Prénom</label>
                <input v-model="nouveauRetardataire.nom" type="text" class="w-full mt-1 p-2 border rounded-xl text-sm font-bold uppercase" placeholder="ex: DUPONT Lucas" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase">Club</label>
                  <select v-model="nouveauRetardataire.club" class="w-full mt-1 p-2 border rounded-xl text-xs bg-white font-bold">
                    <option v-for="c in listeClubs" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase">Poids réel (kg)</label>
                  <input v-model="nouveauRetardataire.poids" type="number" step="0.1" class="w-full mt-1 p-2 border rounded-xl text-sm font-mono font-bold" placeholder="ex: 28.5" />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t">
              <button @click="pouleEnAjoutRetardataire = null" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs">Annuler</button>
              <button @click="validerAjoutRetardataire" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow">➕ Ajouter et recalculer la poule</button>
            </div>
          </div>
        </div>

        <!-- ONGLET 1 : PESÉE & GÉNÉRATION PAR CONVOCATION -->
        <div v-if="activeTab === 'pesee'" class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto print:hidden">
          <div class="bg-white p-6 rounded-xl shadow border border-slate-200 space-y-6">
            
            <!-- CONTRÔLE D'ACTIVATION DU QR CODE / ACCÈS PUBLIC -->
            <div class="bg-indigo-50 border-2 border-indigo-300 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <h4 class="font-black text-indigo-900 text-sm">🌐 Accès Public (QR Code)</h4>
                <p class="text-xs text-indigo-700">Activer pour autoriser les parents à consulter.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="qrCodeActif" @change="toggleQrCodeActif" class="sr-only peer">
                <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div>
              <div class="flex justify-between items-center mb-3">
                <h2 class="text-lg font-bold text-indigo-900">1. Saisie Pesée & Pré-inscriptions</h2>
                <button type="button" @click="afficherImportLot = !afficherImportLot" class="text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-2.5 py-1 rounded-lg transition">
                  {{ afficherImportLot ? '✕ Fermer Import' : '📥 Import Liste Mail' }}
                </button>
              </div>

              <!-- PANNEAU D'IMPORT RAPIDE PAR LOT -->
              <div v-if="afficherImportLot" class="mb-5 p-4 bg-amber-50 border-2 border-amber-400 rounded-2xl space-y-3">
                <h3 class="text-xs font-black text-amber-900 uppercase">📥 Pré-inscrire une liste reçue par mail</h3>
                <p class="text-[11px] text-amber-800">Collez une ligne par judoka (ex: <code class="bg-white px-1 rounded">DUPONT Jean; M; 28</code> ou juste <code class="bg-white px-1 rounded">DUPONT Jean</code>).</p>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-[10px] font-bold text-amber-900 uppercase">Club par défaut</label>
                    <select v-model="clubImportLot" class="w-full p-1.5 border rounded text-xs bg-white font-bold">
                      <option v-for="c in listeClubs" :key="c" :value="c">{{ c }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[10px] font-bold text-amber-900 uppercase">Catégorie par défaut</label>
                    <select v-model="categorieImportLot" class="w-full p-1.5 border rounded text-xs bg-white font-bold">
                      <option v-for="cat in listeCategories" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                  </div>
                </div>
                <textarea v-model="texteImportLot" rows="4" class="w-full p-2 border rounded-lg text-xs font-mono" placeholder="DUPONT Lucas; M; 26.5&#10;MARTIN Chloé; F; 24&#10;BERNARD Léo; M"></textarea>
                <button type="button" @click="importerListePreinscrits" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs shadow transition">
                  ➕ Ajouter ces pré-inscrits (En attente de pesée)
                </button>
              </div>

              <!-- BANDEAU SI UN PRÉ-INSCRIT EST SÉLECTIONNÉ POUR VALIDATION -->
              <div v-if="idPreinscritSelectionne" class="mb-3 p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex justify-between items-center">
                <div>
                  <span class="text-[10px] font-black uppercase text-emerald-700 block">⚡ Rappel d'identité actif</span>
                  <span class="text-xs font-bold text-emerald-950">Complétez le poids réel pour valider la pesée</span>
                </div>
                <button type="button" @click="annulerSelectionPreinscrit" class="text-xs font-bold text-red-600 hover:underline">Annuler</button>
              </div>

              <form @submit.prevent="ajouterJudoka" class="space-y-4">
                <div class="relative">
                  <label class="block text-sm font-medium text-slate-700">Nom & Prénom</label>
                  <input v-model="newJudoka.nom" type="text" required class="w-full mt-1 p-2 border rounded-lg" placeholder="ex: DUPONT Jean" autocomplete="off" />
                  
                  <!-- SUGGESTIONS AUTOMATIQUES DES PRÉ-INSCRITS NON PESÉS -->
                  <div v-if="suggestionsPreinscrits.length > 0" class="mt-1 bg-indigo-950 text-white rounded-xl shadow-xl border-2 border-indigo-400 overflow-hidden z-20">
                    <div class="px-3 py-1 bg-indigo-900 text-[10px] font-black uppercase tracking-wider text-amber-300">
                      💡 Pré-inscrit(s) trouvé(s) — Cliquez pour rappeler :
                    </div>
                    <button
                      v-for="sug in suggestionsPreinscrits"
                      :key="sug.id"
                      type="button"
                      @click="chargerPreinscritDansFormulaire(sug)"
                      class="w-full text-left px-3 py-2 hover:bg-indigo-800 border-t border-indigo-800 flex justify-between items-center text-xs transition"
                    >
                      <div>
                        <span class="font-black text-amber-300">{{ sug.nom }}</span>
                        <span class="text-indigo-200 ml-1">({{ sug.club }} • {{ sug.categorie }})</span>
                      </div>
                      <span class="bg-amber-400 text-black font-black px-2 py-0.5 rounded text-[10px]">
                        {{ sug.poids > 0 ? `Annoncé: ${sug.poids} kg` : 'À peser' }}
                      </span>
                    </button>
                  </div>
                </div>

                <!-- MENU DÉROULANT CLUB AVEC PETITE CROIX DE SUPPRESSION DIRECTE + FERMETURE AUTO -->
                <div class="relative" ref="dropdownClubRef">
                  <div class="flex justify-between items-center">
                    <label class="block text-sm font-medium text-slate-700">Club</label>
                    <button
                      type="button"
                      @click="afficherSaisieNouveauClub = !afficherSaisieNouveauClub; menuClubOuvert = false"
                      class="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {{ afficherSaisieNouveauClub ? '✕ Annuler' : '+ Nouveau club' }}
                    </button>
                  </div>

                  <!-- Champ d'ajout rapide d'un nouveau club -->
                  <div v-if="afficherSaisieNouveauClub" class="mt-1 flex gap-1.5">
                    <input
                      v-model="nomNouveauClub"
                      type="text"
                      class="flex-1 p-2 border-2 border-indigo-500 rounded-lg text-sm font-bold uppercase outline-none"
                      placeholder="Nom du club (ex: BELFORT)..."
                      @keydown.enter.prevent="ajouterNouveauClub"
                    />
                    <button
                      type="button"
                      @click="ajouterNouveauClub"
                      class="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 rounded-lg text-xs shadow transition"
                    >
                      OK
                    </button>
                  </div>

                  <!-- Menu déroulant personnalisé avec croix ✕ sur chaque ligne -->
                  <div v-else class="mt-1 relative">
                    <button
                      type="button"
                      @click="menuClubOuvert = !menuClubOuvert"
                      class="w-full p-2 border rounded-lg bg-white font-semibold text-left flex justify-between items-center hover:border-indigo-500 transition"
                    >
                      <span>{{ newJudoka.club }}</span>
                      <span class="text-slate-400 text-xs">{{ menuClubOuvert ? '▲' : '▼' }}</span>
                    </button>

                    <div
                      v-if="menuClubOuvert"
                      class="absolute left-0 right-0 mt-1 bg-white border-2 border-indigo-500 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-30 divide-y divide-slate-100"
                    >
                      <div
                        v-for="c in listeClubs"
                        :key="c"
                        class="flex justify-between items-center px-3 py-2 hover:bg-indigo-50 transition"
                        :class="newJudoka.club === c ? 'bg-indigo-50/80 font-black text-indigo-900' : 'text-slate-800 font-medium'"
                      >
                        <button
                          type="button"
                          @click="selectionnerClubPesee(c)"
                          class="flex-1 text-left text-sm truncate pr-2"
                        >
                          {{ c }}
                        </button>
                        <button
                          type="button"
                          @click.stop="supprimerClub(c)"
                          class="text-red-500 hover:bg-red-600 hover:text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition shrink-0"
                          title="Supprimer ce club de la liste"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm font-medium text-slate-700">Sexe</label>
                    <select v-model="newJudoka.sexe" class="w-full mt-1 p-2 border rounded-lg"><option value="F">Féminin</option><option value="M">Masculin</option></select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700">Catégorie d'âge</label>
                    <select v-model="newJudoka.categorie" class="w-full mt-1 p-2 border rounded-lg">
                      <option v-for="cat in listeCategories" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700">
                    {{ modePreinscriptionForm ? 'Poids annoncé par mail (optionnel)' : 'Poids réel (kg) — laisser vide si pré-inscription' }}
                  </label>
                  <input v-model="newJudoka.poids" type="number" step="0.1" class="w-full mt-1 p-2 border rounded-lg font-mono font-bold" placeholder="ex: 28.4 (ou vide pour pré-inscrire)" />
                </div>

                <label v-if="!idPreinscritSelectionne" class="flex items-center gap-2 text-xs font-bold text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-300 cursor-pointer">
                  <input type="checkbox" v-model="modePreinscriptionForm" class="rounded text-amber-600" />
                  <span>📋 Enregistrer en Pré-inscription (À peser le jour J)</span>
                </label>

                <button type="submit" :class="idPreinscritSelectionne ? 'bg-emerald-600 hover:bg-emerald-700' : (modePreinscriptionForm || !newJudoka.poids ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700')" class="w-full text-white font-bold py-2.5 rounded-lg transition shadow">
                  {{ idPreinscritSelectionne ? '✅ Valider la Pesée de ce Pré-inscrit' : (modePreinscriptionForm || !newJudoka.poids ? '⏳ Enregistrer en Pré-inscrit (À peser)' : '✅ Enregistrer & Valider la Pesée') }}
                </button>
              </form>
            </div>

            <div class="pt-6 border-t border-slate-200 space-y-4">
              <h3 class="font-bold text-indigo-900 text-lg">2. Génération des Poules (Vers Chambre d'Appel)</h3>
              <p class="text-xs text-slate-500">Génère les poules avec les combattants <strong>✅ Pesés</strong> et les envoie dans l'onglet <strong>📢 Appel & Speaker</strong> (sans toucher aux poules déjà sur tapis).</p>
              
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Catégorie prête à combattre :</label>
                <select v-model="categorieAGenerer" class="w-full p-2.5 border-2 border-amber-500 rounded-lg bg-amber-50 font-black text-slate-900">
                  <option v-for="cat in listeCategories" :key="cat" :value="cat">
                    🥋 {{ cat }} ({{ judokas.filter(j => j.categorie === cat && j.pese).length }} pesés / {{ judokas.filter(j => j.categorie === cat).length }} inscrits)
                  </option>
                  <option value="TOUTES">⚠️ TOUTES LES CATÉGORIES</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Mode de regroupement :</label>
                <select v-model="modeGeneration" class="w-full p-2 border rounded-lg bg-indigo-50 font-bold text-indigo-900">
                  <option value="morpho">⚖️ Morphologique (Groupes de poids proches)</option>
                  <option value="officiel">🏅 Catégories Officielles FFJudo</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de combattants par poule :</label>
                <div class="grid grid-cols-4 gap-1.5">
                  <button type="button" @click="formatPouleChoisi = 'auto'" :class="formatPouleChoisi === 'auto' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-300'" class="py-2 rounded-lg font-bold text-xs border transition">Auto</button>
                  <button type="button" @click="formatPouleChoisi = '3'" :class="formatPouleChoisi === '3' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-300'" class="py-2 rounded-lg font-bold text-xs border transition">Par 3</button>
                  <button type="button" @click="formatPouleChoisi = '4'" :class="formatPouleChoisi === '4' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-300'" class="py-2 rounded-lg font-bold text-xs border transition">Par 4</button>
                  <button type="button" @click="formatPouleChoisi = '5'" :class="formatPouleChoisi === '5' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-700 border-slate-300'" class="py-2 rounded-lg font-bold text-xs border transition">Par 5</button>
                </div>
              </div>

              <button @click="genererPoulesCategorie" class="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3 rounded-lg shadow-lg transition">
                🚀 Générer "{{ categorieAGenerer }}" ➔ Chambre d'Appel
              </button>
            </div>
          </div>

          <div class="md:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-200 space-y-4">
            <div class="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 class="text-lg font-bold text-indigo-900">Liste des Inscrits & Pointage Pesée ({{ judokasFiltres.length }} affichés)</h2>
                <p class="text-xs text-slate-500">
                  ✅ <strong>{{ nbTotalPeses }}</strong> pesé(s) prêt(s) • ⏳ <strong>{{ nbTotalAPeser }}</strong> pré-inscrit(s) en attente de balance
                </p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button @click="filtreStatutPesee = 'TOUS'" :class="filtreStatutPesee === 'TOUS' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'" class="px-3 py-1.5 rounded-lg text-xs font-bold transition">
                  Tous ({{ judokas.length }})
                </button>
                <button @click="filtreStatutPesee = 'A_PESER'" :class="filtreStatutPesee === 'A_PESER' ? 'bg-amber-500 text-black' : 'bg-amber-50 text-amber-900 border border-amber-300'" class="px-3 py-1.5 rounded-lg text-xs font-black transition">
                  ⏳ À peser ({{ nbTotalAPeser }})
                </button>
                <button @click="filtreStatutPesee = 'PESES'" :class="filtreStatutPesee === 'PESES' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-900 border border-emerald-300'" class="px-3 py-1.5 rounded-lg text-xs font-black transition">
                  ✅ Pesés ({{ nbTotalPeses }})
                </button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div class="flex-1 min-w-[200px] relative">
                <input
                  v-model="recherchePesee"
                  type="text"
                  class="w-full pl-3 pr-8 py-2 border-2 border-indigo-300 rounded-lg text-sm font-bold outline-none focus:border-indigo-600 uppercase placeholder:normal-case placeholder:font-normal"
                  placeholder="🔍 Rechercher un nom, prénom ou club pour valider son poids..."
                />
                <button v-if="recherchePesee" @click="recherchePesee = ''" class="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
              </div>
              <select v-model="filtreCatPesee" class="px-3 py-2 border rounded-lg text-xs font-bold bg-white">
                <option value="TOUTES">Toutes catégories</option>
                <option v-for="cat in listeCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
              <button @click="filtreSexePesee = 'TOUS'" :class="filtreSexePesee === 'TOUS' ? 'bg-slate-800 text-white' : 'bg-slate-200'" class="px-3 py-2 rounded-lg text-xs font-bold">Tous</button>
              <button @click="filtreSexePesee = 'M'" :class="filtreSexePesee === 'M' ? 'bg-blue-800 text-white' : 'bg-slate-200'" class="px-3 py-2 rounded-lg text-xs font-bold">Garçons</button>
              <button @click="filtreSexePesee = 'F'" :class="filtreSexePesee === 'F' ? 'bg-pink-800 text-white' : 'bg-slate-200'" class="px-3 py-2 rounded-lg text-xs font-bold">Filles</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="bg-amber-50 border-2 border-amber-400 p-4 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <h4 class="font-black text-amber-900 text-sm">🚨 Secours Coupure Internet :</h4>
                  <p class="text-xs text-amber-800">Imprimez les feuilles de poules officielles sur mesure.</p>
                </div>
                <button @click="imprimerFeuillesTapisGlobal(null)" class="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2.5 rounded-xl text-sm shadow transition flex items-center justify-center gap-2">
                  🖨️ Imprimer les Tableaux (5 Tapis)
                </button>
              </div>

              <div class="bg-red-50 border-2 border-red-400 p-4 rounded-xl flex flex-col justify-between gap-3">
                <div>
                  <h4 class="font-black text-red-900 text-sm">🗑️ Remise à zéro :</h4>
                  <p class="text-xs text-red-800">Efface tous les inscrits et toutes les poules.</p>
                </div>
                <button @click="reinitialiserTout" class="bg-red-600 hover:bg-red-700 text-white font-black px-4 py-2.5 rounded-xl text-sm shadow transition flex items-center justify-center gap-2">
                  ⚠️ Tout réinitialiser / Vider
                </button>
              </div>
            </div>

            <div class="overflow-x-auto max-h-[450px]">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-100 text-slate-600 text-xs uppercase">
                    <th class="p-3">Statut</th>
                    <th class="p-3">Nom Prénom</th>
                    <th class="p-3">Club</th>
                    <th class="p-3">Sexe</th>
                    <th class="p-3">Catégorie</th>
                    <th class="p-3">Poids Réel / Validation</th>
                    <th class="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 text-sm">
                  <tr v-for="j in judokasFiltres" :key="j.id" :class="!j.pese ? 'bg-amber-50/70 hover:bg-amber-100/60' : 'hover:bg-slate-50'">
                    <td class="p-3">
                      <span v-if="j.pese" class="bg-emerald-100 text-emerald-800 font-black px-2 py-1 rounded-full text-[11px]">✅ Pesé</span>
                      <span v-else class="bg-amber-200 text-amber-950 font-black px-2 py-1 rounded-full text-[11px]">⏳ À peser</span>
                    </td>
                    <td class="p-3 font-semibold">{{ j.nom }}</td>
                    <td class="p-3 text-xs font-bold">{{ j.club }}</td>
                    <td class="p-3"><span :class="j.sexe === 'M' ? 'text-blue-600' : 'text-pink-600'" class="font-bold">{{ j.sexe }}</span></td>
                    <td class="p-3"><span class="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded text-xs font-bold">{{ j.categorie }}</span></td>
                    <td class="p-3">
                      <div v-if="!j.pese" class="flex items-center gap-1.5">
                        <input
                          v-model="j.poidsSaisi"
                          type="number"
                          step="0.1"
                          class="w-20 p-1.5 bg-white border-2 border-amber-500 rounded-lg font-mono font-black text-center text-sm outline-none focus:border-emerald-600"
                          placeholder="kg..."
                          @keyup.enter="validerPeseeJudoka(j)"
                        />
                        <button
                          @click="validerPeseeJudoka(j)"
                          class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-black text-xs shadow transition"
                        >
                          ✅ OK
                        </button>
                      </div>

                      <div v-else-if="idJudokaEnEditionPoids === j.id" class="flex items-center gap-1.5">
                        <input
                          v-model="poidsEditionTemp"
                          type="number"
                          step="0.1"
                          class="w-20 p-1 bg-white border-2 border-indigo-500 rounded-lg font-mono font-bold text-center text-sm"
                          @keyup.enter="sauvegarderEditionPoids(j)"
                        />
                        <button @click="sauvegarderEditionPoids(j)" class="bg-indigo-600 text-white px-2.5 py-1 rounded font-bold text-xs">💾</button>
                        <button @click="idJudokaEnEditionPoids = null" class="text-slate-400 hover:text-slate-700 text-xs font-bold">✕</button>
                      </div>

                      <div v-else class="flex items-center gap-2">
                        <span class="font-mono font-bold text-slate-900">{{ j.poids }} kg</span>
                        <button @click="ouvrirEditionPoids(j)" class="text-slate-400 hover:text-indigo-600 text-xs" title="Modifier ce poids">✏️</button>
                      </div>
                    </td>
                    <td class="p-3 text-center">
                      <button @click="supprimerJudoka(j.id)" class="text-red-500 hover:text-red-700 font-bold text-xs uppercase">Supprimer</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ================= ONGLET : CHAMBRE D'APPEL & SPEAKER (PC PORTABLE, TABLETTE & MOBILE) ================= -->
        <div v-if="activeTab === 'appel'" class="space-y-4 sm:space-y-6 max-w-7xl mx-auto print:hidden">
          
          <div class="bg-indigo-950 text-white p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-center gap-4 border-2 border-amber-400">
            <div class="text-center sm:text-left">
              <h2 class="text-xl sm:text-2xl font-black text-amber-400">📢 CHAMBRE D'APPEL & POSTE SPEAKER</h2>
              <p class="text-xs sm:text-sm text-indigo-200 mt-0.5">
                Pointez les judokas à l'appel, gérez les absents/retardataires, puis affectez la poule sur un tapis.
              </p>
            </div>
            <button
              @click="completerTapisAutomatiquement(3)"
              class="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black px-5 py-3.5 rounded-2xl text-xs sm:text-sm shadow-lg transition shrink-0"
            >
              ⚡ Compléter les 5 Tapis (Max 3 poules/table)
            </button>
          </div>

          <!-- BARRE STICKY : CHARGE EN DIRECT DES 5 TAPIS -->
          <div class="sticky top-2 z-20 bg-slate-900/95 backdrop-blur text-white p-3 rounded-2xl shadow-2xl border border-slate-700">
            <div class="flex justify-between items-center mb-2 px-1">
              <span class="text-[11px] font-black uppercase tracking-wider text-amber-400">🏟️ Charge en direct des 5 Tapis (Objectif : 3 poules / table) :</span>
              <span class="text-[11px] font-bold text-emerald-400">Conseillé : Tapis {{ tapisLeMoinsCharge }}</span>
            </div>
            <div class="grid grid-cols-5 gap-1.5 sm:gap-3">
              <div
                v-for="t in 5"
                :key="t"
                :class="statsChargeTapis[t].nbPoulesActives < 3
                  ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                  : (statsChargeTapis[t].nbPoulesActives === 3 ? 'bg-amber-950/90 border-amber-400 text-amber-200' : 'bg-red-950/90 border-red-500 text-red-200')"
                class="border-2 rounded-xl p-2 text-center flex flex-col justify-center items-center"
              >
                <span class="text-[10px] sm:text-xs font-black uppercase tracking-wider">TAPIS {{ t }}</span>
                <span class="text-lg sm:text-2xl font-black leading-tight text-white">
                  {{ statsChargeTapis[t].nbPoulesActives }} <span class="text-[10px] sm:text-xs font-normal opacity-80">poule(s)</span>
                </span>
                <span class="text-[9px] sm:text-[11px] font-semibold opacity-90">
                  {{ statsChargeTapis[t].combatsRestants }} combat(s)
                </span>
              </div>
            </div>
          </div>

          <!-- Filtres -->
          <div class="bg-white p-3 sm:p-4 rounded-2xl shadow border border-slate-200 flex flex-wrap items-center gap-2.5">
            <div class="flex-1 min-w-[180px] relative">
              <input
                v-model="rechercheAppel"
                type="text"
                class="w-full pl-3 pr-8 py-2.5 border-2 border-indigo-300 rounded-xl text-sm font-bold outline-none focus:border-indigo-600 uppercase placeholder:normal-case placeholder:font-normal"
                placeholder="🔍 Chercher un judoka, club ou poule..."
              />
              <button v-if="rechercheAppel" @click="rechercheAppel = ''" class="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
            </div>
            <select v-model="filtreCatAppel" class="px-3 py-2.5 border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-bold bg-slate-50">
              <option value="TOUTES">Toutes catégories ({{ poulesEnAttenteAppel.length }} à appeler)</option>
              <option v-for="cat in listeCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <button
              type="button"
              @click="afficherPoulesDejaEnvoyees = !afficherPoulesDejaEnvoyees"
              :class="afficherPoulesDejaEnvoyees ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'"
              class="px-3.5 py-2.5 rounded-xl text-xs font-black transition"
            >
              {{ afficherPoulesDejaEnvoyees ? '👁️ Masquer les poules déjà sur tapis' : '👁️ Voir aussi les poules déjà envoyées' }}
            </button>
          </div>

          <!-- Liste des cartes de poules à appeler -->
          <div v-if="poulesChambreAppelFiltrees.length === 0" class="bg-white p-12 rounded-3xl shadow border border-slate-200 text-center space-y-2">
            <span class="text-5xl block">🎉</span>
            <p class="text-lg font-black text-slate-700">Aucune poule en attente d'appel pour ce filtre.</p>
            <p class="text-xs text-slate-500">Dès que la table de pesée génère de nouvelles poules, elles apparaissent automatiquement ici.</p>
          </div>

          <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div
              v-for="poule in poulesChambreAppelFiltrees"
              :key="poule.id"
              :class="Number(poule.tapis) === 0 ? 'bg-white border-2 border-indigo-500' : 'bg-slate-50 border-2 border-emerald-500 opacity-90'"
              class="p-4 sm:p-5 rounded-3xl shadow-lg flex flex-col justify-between space-y-4"
            >
              <div class="flex flex-wrap justify-between items-start gap-2 border-b border-slate-200 pb-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span v-if="Number(poule.tapis) === 0" class="bg-amber-400 text-black text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase">
                      📢 À Appeler
                    </span>
                    <span v-else class="bg-emerald-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase">
                      ✅ Sur Tapis {{ poule.tapis }}
                    </span>
                    <span class="text-xs font-bold text-slate-500">{{ poule.categoriePoids }} • {{ (poule.combats || []).length }} combats</span>
                  </div>
                  <h3 class="text-lg sm:text-xl font-black text-indigo-950 mt-1">{{ poule.nom }}</h3>
                </div>

                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    @click="ouvrirModalAjoutRetardataire(poule)"
                    class="bg-orange-100 hover:bg-orange-200 text-orange-900 px-3 py-1.5 rounded-xl text-xs font-black transition"
                    title="Ajouter un retardataire dans cette poule"
                  >
                    ➕ Retardataire
                  </button>
                  <button
                    type="button"
                    @click="toutCocherPresentPoule(poule)"
                    class="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold transition"
                  >
                    ☑️ Tout pointer ({{ (poule.combattants || []).filter(c => c.presentAppel).length }}/{{ (poule.combattants || []).length }})
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <p class="text-[11px] font-bold text-slate-400 uppercase">👆 Cliquez pour pointer les présents, ou retirez un absent (✕ Absent) :</p>
                <div
                  v-for="c in poule.combattants"
                  :key="c.idUnique || c.numero"
                  :class="c.presentAppel ? 'bg-emerald-50 border-emerald-500 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-800'"
                  class="p-3 rounded-2xl border-2 flex justify-between items-center gap-2 transition select-none"
                >
                  <div @click="basculerPresenceAppel(poule, c)" class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                    <span
                      :class="c.presentAppel ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'"
                      class="w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0"
                    >
                      {{ c.presentAppel ? '✓' : c.numero }}
                    </span>
                    <div class="truncate">
                      <span class="font-black text-base block truncate">{{ c.nomSeul }}</span>
                      <span class="text-xs font-bold text-indigo-700 uppercase">{{ c.club }} • {{ c.poids }} kg</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      @click="basculerPresenceAppel(poule, c)"
                      :class="c.presentAppel ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'"
                      class="px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer"
                    >
                      {{ c.presentAppel ? 'Présent' : 'Appeler' }}
                    </button>
                    <button
                      type="button"
                      @click="retirerCombattantAbsent(poule, c.idUnique)"
                      class="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded-xl text-[10px] font-black uppercase"
                      title="Retirer ce combattant absent (recalcule la poule)"
                    >
                      ✕ Absent
                    </button>
                  </div>
                </div>
              </div>

              <div class="pt-2 border-t border-slate-200 space-y-2.5">
                <button
                  v-if="Number(poule.tapis) === 0"
                  type="button"
                  @click="affecterPouleAuTapisDepuisAppel(poule, tapisLeMoinsCharge)"
                  class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-3 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  🚀 Envoyer au Tapis {{ tapisLeMoinsCharge }} (Conseillé : {{ statsChargeTapis[tapisLeMoinsCharge].nbPoulesActives }} poule(s))
                </button>

                <div class="flex items-center justify-between gap-1">
                  <span class="text-[11px] font-black text-slate-500 uppercase mr-1">Ou choisir Tapis :</span>
                  <div class="grid grid-cols-5 gap-1.5 flex-1">
                    <button
                      v-for="t in 5"
                      :key="t"
                      type="button"
                      @click="affecterPouleAuTapisDepuisAppel(poule, t)"
                      :class="Number(poule.tapis) === t
                        ? 'bg-indigo-900 text-amber-300 ring-2 ring-amber-400'
                        : (statsChargeTapis[t].nbPoulesActives < 3 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800')"
                      class="py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-sm active:scale-95 transition flex flex-col items-center leading-tight"
                    >
                      <span>Tapis {{ t }}</span>
                      <span class="text-[9px] font-normal opacity-85">({{ statsChargeTapis[t].nbPoulesActives }})</span>
                    </button>
                  </div>
                  <button
                    v-if="Number(poule.tapis) > 0"
                    type="button"
                    @click="remettrePouleEnChambreAppel(poule)"
                    class="ml-1 bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-2.5 rounded-xl text-xs font-black"
                    title="Remettre en Chambre d'Appel"
                  >
                    ↩️
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ONGLET 2 : GESTION DES TABLES -->
        <div v-if="activeTab === 'tables'" class="space-y-6 max-w-7xl mx-auto print:hidden">
          <div class="text-center bg-indigo-900 text-white p-6 rounded-3xl shadow-xl">
            <h2 class="text-2xl font-black mb-1">🏟️ SÉLECTIONNEZ VOTRE TABLE (AUTONOMIE)</h2>
            <p class="text-indigo-200 text-sm">Chaque table reçoit ses poules au fur et à mesure depuis la Chambre d'Appel Speaker ({{ poulesEnAttenteAppel.length }} poule(s) en réserve d'appel)</p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <button v-for="t in 5" :key="t" @click="selectedTapis = t" :class="selectedTapis === t ? 'bg-indigo-600 text-white border-indigo-500 shadow-2xl scale-105' : 'bg-white text-indigo-900 border-slate-200 hover:bg-indigo-50'" class="p-4 sm:p-6 rounded-2xl border-2 font-black text-xl sm:text-2xl transition flex flex-col items-center justify-center gap-1.5">
              <span>TABLE {{ t }}</span>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="selectedTapis === t ? 'bg-indigo-800 text-white' : 'bg-indigo-100 text-indigo-800'">
                {{ statsChargeTapis[t].nbPoulesActives }} active(s)
              </span>
            </button>
          </div>

          <div class="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 space-y-6">
            <div>
              <div class="mb-4 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 class="text-xl font-bold text-indigo-900">📋 Poules envoyées à la Table {{ selectedTapis }}</h3>
                  <p class="text-xs text-slate-500">Le speaker alimente votre table au fur et à mesure. Dès qu'une poule est terminée, elle part automatiquement à la Table des Médailles.</p>
                </div>
                <button @click="activeTab = 'appel'" class="bg-amber-100 hover:bg-amber-200 text-amber-900 font-black px-3.5 py-2 rounded-xl text-xs transition">
                  📢 Aller à la Chambre d'Appel ({{ poulesEnAttenteAppel.length }} en attente)
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="poule in poules.filter(p => Number(p.tapis) === selectedTapis)" :key="poule.id" class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div class="flex flex-wrap justify-between items-center gap-2">
                    <span class="font-black text-indigo-900 text-lg">{{ poule.nom }}</span>
                    <div class="flex items-center gap-2">
                      <select :value="poule.tapis" @change="changerTapisPoule(poule, $event.target.value)" class="text-xs font-bold bg-white border border-indigo-300 text-indigo-900 rounded-lg px-2 py-1 shadow-sm cursor-pointer" title="Déplacer cette poule">
                        <option :value="0">📢 Retour Appel</option>
                        <option v-for="t in 5" :key="t" :value="t">➔ Tapis {{ t }}</option>
                      </select>
                      <span v-if="pouleEstTerminee(poule)" class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">🏆 Terminée (Envoyée aux Médailles)</span>
                      <span v-else class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">⏳ En cours</span>
                      <button @click="supprimerPoule(poule.id)" class="text-red-400 hover:text-red-600 text-xs font-bold px-1" title="Supprimer cette poule">✕</button>
                    </div>
                  </div>
                  <p class="text-xs text-slate-600">{{ (poule.combattants || []).length }} combattants • {{ (poule.combats || []).length }} combats ({{ (poule.combats || []).filter(c => c.statut === 'termine').length }} terminés)</p>
                </div>
              </div>
            </div>

            <hr class="border-slate-200">

            <div>
              <div class="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                  <h3 class="text-xl font-bold text-indigo-900">🔄 File d'attente de la Table {{ selectedTapis }} (Alternance intégrale)</h3>
                  <p class="text-xs text-slate-500">En cas de double ou triple poule sur ce tapis, les combats s'intercalent automatiquement (Poule A ➔ Poule B ➔ Poule C) même si le 1er combat a déjà commencé.</p>
                </div>
                <button @click="activeTab = 'match'" v-if="matchActif" class="bg-amber-500 hover:bg-amber-600 text-black font-black px-4 py-2 rounded-xl text-sm shadow">
                  ⚡ Reprendre le combat en cours
                </button>
              </div>

              <div class="space-y-3">
                <div v-for="(item, idx) in getFileAttentePourTapis(selectedTapis)" :key="idx" :class="item.combat.statut === 'termine' ? 'bg-slate-100 opacity-60' : 'bg-indigo-50 border-indigo-300'" class="p-4 rounded-xl border flex flex-wrap justify-between items-center gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-black text-white bg-indigo-700 px-2.5 py-1 rounded">Tour {{ item.tourNum }}</span>
                    <span class="text-xs font-bold text-indigo-900 bg-indigo-200 px-2.5 py-1 rounded">{{ item.nomPoule }}</span>
                    <span class="font-bold text-slate-900 text-base">
                      🟥 #{{ item.combat.c1Num }} {{ item.c1Nom }} <span class="text-slate-400 font-normal">vs</span> ⬜ #{{ item.combat.c2Num }} {{ item.c2Nom }}
                    </span>
                    <span v-if="item.combat.statut === 'termine'" class="text-xs font-bold text-emerald-600">✅ Terminé (Score : {{ item.combat.scoreC1 }} - {{ item.combat.scoreC2 }})</span>
                  </div>
                  <button @click="lancerCombatTable(item, selectedTapis)" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition">
                    {{ item.combat.statut === 'termine' ? 'Modifier sur la Table' : '⏱️ Lancer ce combat' }}
                  </button>
                </div>
                <div v-if="getFileAttentePourTapis(selectedTapis).length === 0" class="text-center py-8 text-slate-400 italic">
                  Aucun combat actif sur cette table. Le speaker peut envoyer des poules depuis l'onglet « 📢 Appel & Speaker ».
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ONGLET : TABLE DES MÉDAILLES EN DIRECT -->
        <div v-if="activeTab === 'medailles'" class="space-y-6 max-w-7xl mx-auto print:hidden">
          <div class="text-center bg-amber-600 text-white p-6 rounded-3xl shadow-xl">
            <h2 class="text-3xl font-black mb-1">🥇 TABLE DES MÉDAILLES & PODIUMS EN DIRECT</h2>
            <p class="text-amber-100 text-sm">Tous les combattants sont récompensés (1er, 2ème, 3ème, 3ème Bis, 3ème Ter + 1er d'office Hors-Concours).</p>
          </div>

          <div v-if="poulesTerminees.length === 0" class="text-center py-16 bg-white rounded-2xl shadow border border-slate-200">
            <span class="text-5xl block mb-3">⏳</span>
            <p class="text-xl font-bold text-slate-600">Aucune poule n'est encore terminée pour le moment.</p>
            <p class="text-sm text-slate-400 mt-1">Les podiums apparaîtront ici en direct dès la fin des combats sur les tables.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div v-for="poule in poulesTerminees" :key="poule.id" 
                 :class="poule.prepareMedaille ? 'bg-slate-100 opacity-60 border-slate-300' : 'bg-white border-2 border-amber-400 shadow-lg'" 
                 class="p-6 rounded-3xl transition space-y-4">
              
              <div class="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <span class="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full uppercase">Table {{ poule.tapis }}</span>
                  <h3 :class="poule.prepareMedaille ? 'line-through text-slate-500' : 'text-indigo-900'" class="text-xl font-black mt-1">{{ poule.nom }}</h3>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="imprimerEtValiderMedaille(poule)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow transition flex items-center gap-2">
                    🖨️ Imprimer & Valider
                  </button>
                </div>
              </div>

              <div v-if="(poule.combattants || []).some(c => c.horsConcours)" class="space-y-2">
                <div v-for="hc in (poule.combattants || []).filter(c => c.horsConcours)" :key="hc.idUnique" class="bg-red-50 border border-red-300 p-3 rounded-2xl flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">🥇</span>
                    <div>
                      <span class="block text-base font-black text-red-900">{{ hc.nomSeul }}</span>
                      <span class="text-xs text-red-700 uppercase font-bold">{{ hc.club }} • HORS CONCOURS</span>
                    </div>
                  </div>
                  <span class="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full">1er D'OFFICE</span>
                </div>
              </div>

              <div class="space-y-2">
                <div v-for="(c, idx) in calculerClassementPoule(poule)" :key="idx" :class="idx === 0 ? 'bg-amber-50 border-amber-300 font-bold' : idx === 1 ? 'bg-slate-100 border-slate-300' : 'bg-orange-50 border-orange-200'" class="p-3 rounded-2xl border flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <span class="text-xl">{{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉' }}</span>
                    <div>
                      <span class="block text-base font-black text-slate-900">{{ getLibellePlaceJudo(idx) }} — {{ c.nomSeul }}</span>
                      <span class="text-xs text-slate-500 uppercase">{{ c.club }} • {{ c.poids }} kg</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-sm font-bold text-emerald-600 block">{{ c.victoires }} victoires</span>
                    <span class="text-xs text-slate-400 font-mono">{{ c.points }} pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ================= ONGLET 3 : TABLE DE MARQUE PRO AUTONOME (LARGEUR TOTALE ÉCRAN + ENCART GAUCHE COMPLET) ================= -->
        <div v-if="activeTab === 'match' && matchActif" class="bg-slate-950 text-white p-4 sm:p-5 rounded-3xl shadow-2xl w-full max-w-none space-y-3 print:hidden border border-slate-800">
          
          <!-- Barre supérieure compacte regroupant le titre de la table et le combat à suivre -->
          <div class="flex flex-wrap justify-between items-center border-b border-slate-800 pb-2.5 gap-3">
            <div class="flex items-center gap-3">
              <span class="bg-amber-400 text-black font-black px-3 py-1 rounded-xl text-sm uppercase">TABLE {{ matchActif.tapis }}</span>
              <h2 class="text-lg sm:text-xl font-black text-white tracking-wide">{{ matchActif.nomPoule }}</h2>
            </div>
            <div class="bg-slate-900 px-3.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
              <span class="font-black text-amber-400 uppercase">⏳ À SUIVRE :</span>
              <span class="font-bold text-white truncate max-w-md">{{ matchActif?.prochainCombat || '---' }}</span>
            </div>
          </div>

          <!-- BANDEAU SALUT FINAL DE LA POULE (AFFICHE LE PODIUM SUR L'ÉCRAN DÉPORTÉ EN ATTENDANT LE SALUT DE L'ARBITRE) -->
          <div v-if="pouleDuMatchActifEstTerminee" class="bg-amber-500 text-black p-4 rounded-2xl shadow-xl flex flex-wrap justify-between items-center gap-4 border-4 border-white">
            <div>
              <span class="text-xs font-black uppercase bg-black text-amber-400 px-2.5 py-0.5 rounded-full">🏆 POULE TERMINÉE — PODIUM AFFICHÉ SUR L'ÉCRAN DÉPORTÉ</span>
              <h3 class="text-lg sm:text-xl font-black mt-1">L'arbitre peut procéder au salut final avec le classement affiché sur la TV !</h3>
            </div>
            <div class="flex items-center gap-2">
              <button @click="annulerVictoireEnCours" class="bg-black/20 hover:bg-black/30 text-black px-3 py-2.5 rounded-xl font-bold text-xs transition">
                ↩️ Corriger le match
              </button>
              <button @click="passerAuCombatSuivant" class="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-3 rounded-xl font-black text-sm shadow-lg transition">
                🏅 SALUT EFFECTUÉ — VALIDER LE CLASSEMENT & SUIVANT ➔
              </button>
            </div>
          </div>

          <!-- EN CAS D'ÉGALITÉ PARFAITE -->
          <div v-else-if="matchActif.egaliteTotale" class="bg-amber-500 text-black p-4 rounded-2xl text-center shadow-xl space-y-2.5">
            <h3 class="text-lg font-black">⚖️ FIN DU TEMPS : ÉGALITÉ PARFAITE ! L'arbitre départage :</h3>
            <div class="flex flex-wrap justify-center gap-3">
              <button @click="declencherVictoire(matchActif.c1.nom, matchActif.c1.club, false, true)" class="bg-red-900 text-white px-4 py-2 rounded-xl font-black text-xs sm:text-sm shadow">
                👉 Vainqueur : Rouge ({{ matchActif.c1.nom }})
              </button>
              <button @click="declencherVictoire(matchActif.c2.nom, matchActif.c2.club, false, true)" class="bg-indigo-900 text-white px-4 py-2 rounded-xl font-black text-xs sm:text-sm shadow">
                👉 Vainqueur : Blanc ({{ matchActif.c2.nom }})
              </button>
              <button @click="declencherVictoire('MATCH NUL', 'ÉGALITÉ', true, false)" class="bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-xs sm:text-sm shadow">
                🤝 Match Nul
              </button>
            </div>
          </div>

          <div v-else-if="matchActif.vainqueur" class="bg-emerald-600 p-3.5 rounded-2xl text-center shadow-xl flex flex-wrap justify-between items-center gap-3">
            <span class="font-black text-lg">🏆 VICTOIRE DE : {{ matchActif.vainqueur }} — Cliquez sur « Valider & Combat suivant » à gauche.</span>
            <button @click="annulerVictoireEnCours" class="bg-black/40 hover:bg-black text-white px-3 py-1.5 rounded-xl font-bold text-xs">
              ↩️ Annuler la décision
            </button>
          </div>

          <!-- GRILLE PRINCIPALE PLEINE LARGEUR : ENCART GAUCHE (TOUS LES BOUTONS + CHRONO COMPACT) & CARTES COMBATTANTS AGRANDIES À DROITE -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            <!-- ENCART GAUCHE (3 colonnes sur 12) : CHRONO COMPACT + CHANGEMENT DE TEMPS + BOUTONS SUIVANT / PRÉCÉDENT / ÉCRAN DÉPORTÉ -->
            <div class="lg:col-span-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3 text-center">
              
              <!-- Chronomètre principal réduit et ergonomique -->
              <div class="space-y-2">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">CHRONOMÈTRE PRINCIPAL</span>
                <div class="text-4xl font-black font-mono tracking-wider text-amber-400 bg-slate-950 py-2 rounded-xl border border-slate-800">
                  {{ formatTemps }}
                </div>
                <button @click="toggleTimer" :class="chronoEnCours ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'" class="w-full py-3 rounded-xl font-black text-base text-white shadow-lg transition">
                  {{ chronoEnCours ? '⏸️ MATTE (Pause)' : '▶️ HAJIME (Start)' }}
                </button>
                <div class="grid grid-cols-3 gap-1.5 pt-1">
                  <button @click="setTemps(90)" class="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-bold text-xs border border-slate-700">1m30</button>
                  <button @click="setTemps(120)" class="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-bold text-xs border border-slate-700">2 min</button>
                  <button @click="setTemps(180)" class="bg-slate-800 hover:bg-slate-700 py-2 rounded-lg font-bold text-xs border border-slate-700">3 min</button>
                </div>
              </div>

              <!-- Actions de navigation regroupées dans l'encart gauche -->
              <div class="pt-3 border-t border-slate-800 space-y-2">
                <button
                  @click="validerEtSuivantManuel"
                  class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 px-3 rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-1.5"
                >
                  {{ pouleDuMatchActifEstTerminee ? '🏅 VALIDER SALUT & SUIVANT ➔' : '💾 VALIDER & COMBAT SUIVANT ➔' }}
                </button>

                <button
                  @click="retourCombatPrecedent"
                  class="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-3 rounded-xl font-black text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  ⬅️ RETOUR COMBAT PRÉCÉDENT
                </button>

                <a
                  :href="urlEcranCombat"
                  target="_blank"
                  class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs shadow transition flex items-center justify-center gap-1.5"
                >
                  🖥️ OUVRIR ÉCRAN DÉPORTÉ (TV {{ matchActif.tapis }})
                </a>
              </div>
            </div>

            <!-- TABLEAU PRINCIPAL DES 2 COMBATTANTS AGRANDI (9 colonnes sur 12) -->
            <div class="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <!-- COMBATTANT 1 : ROUGE -->
              <div class="bg-slate-900 p-5 sm:p-6 rounded-2xl border-4 border-red-600 shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div class="flex justify-between items-center">
                    <span class="bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase">🟥 1er Appelé — ROUGE</span>
                    <span class="text-sm text-slate-400 font-black">#{{ matchActif.c1.numero }}</span>
                  </div>
                  <h3 class="font-black text-2xl sm:text-3xl text-white truncate mt-2">{{ matchActif.c1.nom }}</h3>
                  <p class="text-sm sm:text-base font-bold text-red-300 uppercase truncate">{{ matchActif.c1.club }}</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <span class="text-xs font-black text-amber-400">SHIDOS : {{ matchActif.c1.shido }}</span>
                  <div class="flex gap-1.5 ml-1" v-if="matchActif.c1.shido > 0">
                    <span v-for="s in matchActif.c1.shido" :key="s" :class="s === 3 ? 'carton-rouge-table' : 'carton-jaune-table'"></span>
                  </div>
                  <button @click="updateShido(1, 1)" class="ml-auto bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1.5 rounded-lg font-black text-xs shadow">+1 Shido</button>
                  <button @click="updateShido(1, -1)" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-black text-xs">-1</button>
                </div>

                <!-- GROS COMPTEURS ET GROS BOUTONS + / - POUR IPPON, WAZA, YUKO -->
                <div class="grid grid-cols-3 gap-3 text-center">
                  <!-- IPPON -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-emerald-500/60 flex flex-col justify-between">
                    <span class="block text-xs text-emerald-300 font-black tracking-wider">IPPON</span>
                    <span class="text-5xl font-black text-emerald-400 my-1.5">{{ matchActif.c1.ippon }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(1, 'ippon', 1)" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(1, 'ippon', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                  <!-- WAZA-ARI -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-blue-500/60 flex flex-col justify-between">
                    <span class="block text-xs text-blue-300 font-black tracking-wider">WAZA-ARI</span>
                    <span class="text-5xl font-black text-blue-400 my-1.5">{{ matchActif.c1.waza }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(1, 'waza', 1)" class="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(1, 'waza', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                  <!-- YUKO -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-amber-400/60 flex flex-col justify-between">
                    <span class="block text-xs text-amber-200 font-black tracking-wider">YUKO</span>
                    <span class="text-5xl font-black text-amber-300 my-1.5">{{ matchActif.c1.yuko }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(1, 'yuko', 1)" class="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(1, 'yuko', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                </div>

                <!-- EMPLACEMENT OSAEKOMI ROUGE : BOUTON REMPLACÉ EN SUPERPOSITION PAR LA JAUGE + BOUTON TOKETA DIRECT -->
                <div class="w-full">
                  <button
                    v-if="!osaekomiActif || osaekomiCombattant !== 1"
                    @click="startOsae(1)"
                    class="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-black py-4 rounded-2xl transition text-base shadow-lg"
                  >
                    ⏱️ Lancer Osaekomi (Rouge)
                  </button>

                  <!-- Jauge superposée exactement à l'emplacement du bouton avec TOKETA directement cliquable dessus -->
                  <div v-else class="w-full bg-slate-950 border-4 border-amber-400 p-3 rounded-2xl space-y-2 shadow-2xl">
                    <div class="flex justify-between items-center px-1">
                      <span class="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                        ⏱️ OSAEKOMI ROUGE
                        <span v-if="osaekomiTemps >= seuilWazaCourant" class="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                          WAZA-ARI ACQUIS !
                        </span>
                      </span>
                      <span class="text-xl font-black font-mono text-white">
                        {{ osaekomiTemps }}s <span class="text-xs text-slate-400">/ {{ seuilIpponCourant }}s</span>
                      </span>
                    </div>

                    <div class="relative w-full h-11 bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                      <div
                        class="h-full transition-all duration-150 ease-linear"
                        :class="osaekomiTemps >= seuilWazaCourant ? 'bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'"
                        :style="{ width: pourcentageJaugeOsae + '%' }"
                      ></div>

                      <!-- Ligne pointillée exacte du Waza-ari (7s ou 10s) -->
                      <div
                        class="absolute top-0 bottom-0 border-l-4 border-dashed border-white z-10 flex items-start pt-0.5"
                        :style="{ left: positionMarqueurWaza + '%' }"
                      >
                        <span class="bg-black/80 text-white text-[9px] font-black px-1.5 rounded ml-1">
                          Waza ({{ seuilWazaCourant }}s)
                        </span>
                      </div>

                      <!-- Bouton TOKETA en superposition directe sur la jauge -->
                      <button
                        type="button"
                        @click="toketa"
                        class="absolute inset-0 z-20 flex items-center justify-center bg-black/35 hover:bg-red-600/80 text-white font-black text-sm uppercase tracking-wider transition"
                      >
                        ✋ TOKETA — STOP ({{ osaekomiTemps }}s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- COMBATTANT 2 : BLANC -->
              <div class="bg-slate-900 p-5 sm:p-6 rounded-2xl border-4 border-indigo-600 shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div class="flex justify-between items-center">
                    <span class="bg-indigo-600 text-white text-xs font-black px-3 py-1 rounded-full uppercase">⬜ 2ème Appelé — BLANC</span>
                    <span class="text-sm text-slate-400 font-black">#{{ matchActif.c2.numero }}</span>
                  </div>
                  <h3 class="font-black text-2xl sm:text-3xl text-white truncate mt-2">{{ matchActif.c2.nom }}</h3>
                  <p class="text-sm sm:text-base font-bold text-indigo-300 uppercase truncate">{{ matchActif.c2.club }}</p>
                </div>
                
                <div class="flex flex-wrap items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <span class="text-xs font-black text-amber-400">SHIDOS : {{ matchActif.c2.shido }}</span>
                  <div class="flex gap-1.5 ml-1" v-if="matchActif.c2.shido > 0">
                    <span v-for="s in matchActif.c2.shido" :key="s" :class="s === 3 ? 'carton-rouge-table' : 'carton-jaune-table'"></span>
                  </div>
                  <button @click="updateShido(2, 1)" class="ml-auto bg-amber-500 hover:bg-amber-400 text-black px-3.5 py-1.5 rounded-lg font-black text-xs shadow">+1 Shido</button>
                  <button @click="updateShido(2, -1)" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-black text-xs">-1</button>
                </div>

                <!-- GROS COMPTEURS ET GROS BOUTONS + / - POUR IPPON, WAZA, YUKO -->
                <div class="grid grid-cols-3 gap-3 text-center">
                  <!-- IPPON -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-emerald-500/60 flex flex-col justify-between">
                    <span class="block text-xs text-emerald-300 font-black tracking-wider">IPPON</span>
                    <span class="text-5xl font-black text-emerald-400 my-1.5">{{ matchActif.c2.ippon }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(2, 'ippon', 1)" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(2, 'ippon', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                  <!-- WAZA-ARI -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-blue-500/60 flex flex-col justify-between">
                    <span class="block text-xs text-blue-300 font-black tracking-wider">WAZA-ARI</span>
                    <span class="text-5xl font-black text-blue-400 my-1.5">{{ matchActif.c2.waza }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(2, 'waza', 1)" class="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(2, 'waza', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                  <!-- YUKO -->
                  <div class="bg-slate-950 p-3 rounded-2xl border-2 border-amber-400/60 flex flex-col justify-between">
                    <span class="block text-xs text-amber-200 font-black tracking-wider">YUKO</span>
                    <span class="text-5xl font-black text-amber-300 my-1.5">{{ matchActif.c2.yuko }}</span>
                    <div class="grid grid-cols-2 gap-2 mt-1">
                      <button @click="updateScore(2, 'yuko', 1)" class="bg-amber-500 hover:bg-amber-400 active:scale-95 text-black py-3 rounded-xl font-black text-xl shadow-md transition">+</button>
                      <button @click="updateScore(2, 'yuko', -1)" class="bg-red-700 hover:bg-red-600 active:scale-95 text-white py-3 rounded-xl font-black text-xl shadow-md transition">-</button>
                    </div>
                  </div>
                </div>

                <!-- EMPLACEMENT OSAEKOMI BLANC : BOUTON REMPLACÉ EN SUPERPOSITION PAR LA JAUGE + BOUTON TOKETA DIRECT -->
                <div class="w-full">
                  <button
                    v-if="!osaekomiActif || osaekomiCombattant !== 2"
                    @click="startOsae(2)"
                    class="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-black font-black py-4 rounded-2xl transition text-base shadow-lg"
                  >
                    ⏱️ Lancer Osaekomi (Blanc)
                  </button>

                  <!-- Jauge superposée exactement à l'emplacement du bouton avec TOKETA directement cliquable dessus -->
                  <div v-else class="w-full bg-slate-950 border-4 border-amber-400 p-3 rounded-2xl space-y-2 shadow-2xl">
                    <div class="flex justify-between items-center px-1">
                      <span class="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                        ⏱️ OSAEKOMI BLANC
                        <span v-if="osaekomiTemps >= seuilWazaCourant" class="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                          WAZA-ARI ACQUIS !
                        </span>
                      </span>
                      <span class="text-xl font-black font-mono text-white">
                        {{ osaekomiTemps }}s <span class="text-xs text-slate-400">/ {{ seuilIpponCourant }}s</span>
                      </span>
                    </div>

                    <div class="relative w-full h-11 bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
                      <div
                        class="h-full transition-all duration-150 ease-linear"
                        :class="osaekomiTemps >= seuilWazaCourant ? 'bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'"
                        :style="{ width: pourcentageJaugeOsae + '%' }"
                      ></div>

                      <!-- Ligne pointillée exacte du Waza-ari (7s ou 10s) -->
                      <div
                        class="absolute top-0 bottom-0 border-l-4 border-dashed border-white z-10 flex items-start pt-0.5"
                        :style="{ left: positionMarqueurWaza + '%' }"
                      >
                        <span class="bg-black/80 text-white text-[9px] font-black px-1.5 rounded ml-1">
                          Waza ({{ seuilWazaCourant }}s)
                        </span>
                      </div>

                      <!-- Bouton TOKETA en superposition directe sur la jauge -->
                      <button
                        type="button"
                        @click="toketa"
                        class="absolute inset-0 z-20 flex items-center justify-center bg-black/35 hover:bg-red-600/80 text-white font-black text-sm uppercase tracking-wider transition"
                      >
                        ✋ TOKETA — STOP ({{ osaekomiTemps }}s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- ONGLET 4 : ÉCRAN TV & QR CODE PARENTS UNIQUEMENT -->
        <div v-if="activeTab === 'tv'" class="space-y-8 max-w-7xl mx-auto print:hidden">
          <div class="text-center bg-indigo-900 text-white p-8 rounded-3xl shadow-xl">
            <h2 class="text-4xl font-black tracking-wider mb-2">📺 ÉCRAN TV — ACCÈS SÉCURISÉ PARENTS</h2>
            <p class="text-indigo-200 text-lg">Scannez le QR Code pour suivre les résultats en direct</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white p-8 rounded-3xl shadow-lg border border-slate-200">
            <div class="text-center flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
              <h3 class="font-bold text-xl text-indigo-900 mb-2">📷 QR Code Parents</h3>
              <div class="bg-white p-4 rounded-2xl shadow-md border inline-block">
                <img :src="`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(urlAppPublic)}`" alt="QR Code" class="w-52 h-52 mx-auto" />
              </div>
              <p class="text-xs text-slate-500 mt-3 break-all max-w-xs font-mono">{{ urlAppPublic }}</p>
              <a :href="urlAppPublic" target="_blank" class="mt-3 inline-block bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold px-4 py-2 rounded-xl text-xs transition">
                🔗 Tester l'ouverture du lien public dans un nouvel onglet
              </a>
            </div>

            <div>
              <h3 class="font-bold text-xl text-indigo-900 mb-3">🏟️ État Global des 5 Tables ({{ poulesEnAttenteAppel.length }} en appel)</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto">
                <div v-for="t in 5" :key="t" class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div class="flex justify-between items-center bg-indigo-600 text-white font-bold px-3 py-1 rounded-lg mb-2 text-sm">
                    <span>TABLE {{ t }}</span>
                    <span class="text-xs">{{ statsChargeTapis[t].nbPoulesActives }} active(s)</span>
                  </div>
                  <div v-for="poule in poules.filter(p => Number(p.tapis) === t)" :key="poule.id" class="text-xs text-slate-700 mb-1 font-semibold">
                    • {{ poule.nom }} ({{ (poule.combattants || []).length }} judokas)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </template>
  </div>
</template>

<style>
@keyframes fall {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(105vh) rotate(360deg); opacity: 0; }
}
.confetti {
  position: absolute;
  width: 12px;
  height: 25px;
  background-color: #ffd700;
  top: -10px;
  animation: fall 3s infinite linear;
}
.confetti.c1 { left: 10%; background: #ff4757; animation-delay: 0s; animation-duration: 2.5s; }
.confetti.c2 { left: 30%; background: #2ed573; animation-delay: 0.5s; animation-duration: 3s; }
.confetti.c3 { left: 50%; background: #ffa502; animation-delay: 0.2s; animation-duration: 2.8s; }
.confetti.c4 { left: 70%; background: #1e90ff; animation-delay: 0.8s; animation-duration: 3.2s; }
.confetti.c5 { left: 85%; background: #9b59b6; animation-delay: 0.3s; animation-duration: 2.6s; }
.confetti.c6 { left: 95%; background: #ff6b81; animation-delay: 1s; animation-duration: 3.5s; }

/* Cartons de Shido en CSS pur */
.carton-jaune-tv {
  display: inline-block;
  width: 2.2vh;
  min-width: 18px;
  height: 3.2vh;
  min-height: 26px;
  background-color: #facc15;
  border: 2px solid #000;
  border-radius: 4px;
  box-shadow: 0 0 15px rgba(250, 204, 21, 0.9);
  transform: rotate(4deg);
}
.carton-rouge-tv {
  display: inline-block;
  width: 2.5vh;
  min-width: 20px;
  height: 3.6vh;
  min-height: 28px;
  background-color: #ef4444;
  border: 2px solid #fff;
  border-radius: 4px;
  box-shadow: 0 0 20px rgba(239, 68, 68, 1);
  transform: rotate(4deg);
}
.carton-jaune-table {
  display: inline-block;
  width: 16px;
  height: 24px;
  background-color: #facc15;
  border: 1px solid #000;
  border-radius: 3px;
}
.carton-rouge-table {
  display: inline-block;
  width: 18px;
  height: 26px;
  background-color: #ef4444;
  border: 1px solid #fff;
  border-radius: 3px;
}

/* Animation IPPON / HANSOKU-MAKE */
@keyframes ipponSlide {
  0% { transform: translateX(120vw); opacity: 0; scale: 0.8; }
  15% { transform: translateX(0); opacity: 1; scale: 1.1; }
  85% { transform: translateX(0); opacity: 1; scale: 1.1; }
  100% { transform: translateX(-120vw); opacity: 0; scale: 0.8; }
}
.animate-ippon-slide {
  animation: ipponSlide 3s ease-in-out forwards;
}
</style>