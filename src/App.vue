<script setup>
import { ref, computed, onMounted } from 'vue';
import { db, ref as dbRef, set, onValue, push, remove } from './firebase';

// États de l'application
const activeTab = ref('pesee'); // 'pesee', 'tapis', 'poule'
const selectedTapis = ref(1);
const selectedPouleId = ref(null);

// Formulaire de pesée
const newJudoka = ref({
  nom: '',
  club: '',
  sexe: 'F',
  categorie: 'Minimes',
  poids: ''
});

// Données synchronisées Firebase
const judokas = ref([]);
const poules = ref([]);

// Charger les données en temps réel depuis Firebase
onMounted(() => {
  const judokasRef = dbRef(db, 'judokas');
  onValue(judokasRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      judokas.value = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
      judokas.value = [];
    }
  });

  const poulesRef = dbRef(db, 'poules');
  onValue(poulesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      poules.value = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    } else {
      poules.value = [];
    }
  });
});

// Ajouter un judoka
const ajouterJudoka = () => {
  if (!newJudoka.value.nom || !newJudoka.value.poids) return;
  const judokasRef = dbRef(db, 'judokas');
  push(judokasRef, {
    nom: newJudoka.value.nom.toUpperCase(),
    club: newJudoka.value.club || 'USPV Judo',
    sexe: newJudoka.value.sexe,
    categorie: newJudoka.value.categorie,
    poids: parseFloat(newJudoka.value.poids)
  });
  newJudoka.value.nom = '';
  newJudoka.value.poids = '';
};

// Supprimer un judoka
const supprimerJudoka = (id) => {
  remove(dbRef(db, `judokas/${id}`));
};

// Algorithme de génération des poules (par paquets de 3 sur 5 tapis)
const genererPoules = () => {
  const groupes = {};
  judokas.value.forEach(j => {
    const cle = `${j.categorie} ${j.sexe}`;
    if (!groupes[cle]) groupes[cle] = [];
    groupes[cle].push(j);
  });

  let toutesLesPoules = [];
  let indexPouleGlobal = 0;

  Object.keys(groupes).forEach(cle => {
    const liste = groupes[cle].sort((a, b) => a.poids - b.poids);
    const N = liste.length;
    if (N === 0) return;

    const nbPoules = N <= 5 ? 1 : Math.ceil(N / 4);
    const partitions = Array.from({ length: nbPoules }, () => []);
    liste.forEach((j, i) => {
      const pIdx = Math.floor((i * nbPoules) / N);
      partitions[pIdx].push(j);
    });

    partitions.forEach((combattants, pIdx) => {
      indexPouleGlobal++;
      const nomPoule = `${cle} Morpho (Gr ${pIdx + 1})`;
      // Répartition par paquets de 3 sur 5 tapis
      const tapis = Math.floor((indexPouleGlobal - 1) / 3) % 5 + 1;

      toutesLesPoules.push({
        id: `poule_${indexPouleGlobal}`,
        nom: nomPoule,
        tapis: tapis,
        combattants: combattants.map((c, cIdx) => ({
          numero: cIdx + 1,
          nomComplet: `${c.nom} (${c.club})`,
          club: c.club,
          poids: c.poids,
          scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }))
      });
    });
  });

  set(dbRef(db, 'poules'), toutesLesPoules);
  alert("Poules générées et réparties sur les 5 tapis avec succès !");
};

const poulesDuTapis = computed(() => {
  return poules.value.filter(p => p.tapis === selectedTapis.value);
});

const calculerClassement = (poule) => {
  return poule.combattants.map(c => {
    let totalPoints = 0;
    let victoires = 0;
    Object.keys(c.scores).forEach(opp => {
      const pts = Number(c.scores[opp]) || 0;
      totalPoints += pts;
      if (pts > 0) victoires++;
    });
    return { ...c, totalPoints, victoires };
  }).sort((a, b) => {
    if (b.victoires !== a.victoires) return b.victoires - a.victoires;
    return b.totalPoints - a.totalPoints;
  });
};

const mettreAJourScore = (pouleId, combattantNum, adversaireNum, valeur) => {
  const poule = poules.value.find(p => p.id === pouleId);
  if (!poule) return;
  const combattant = poule.combattants.find(c => c.numero === combattantNum);
  if (combattant) {
    combattant.scores[adversaireNum] = Number(valeur) || 0;
    set(dbRef(db, `poules`), poules.value);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 font-sans">
    <header class="bg-indigo-900 text-white shadow-md p-4 flex justify-between items-center">
      <h1 class="text-xl font-bold tracking-wide">🥋 TOURNOI DE JUDO — MANAGER MULTI-POSTES</h1>
      <nav class="flex gap-2">
        <button @click="activeTab = 'pesee'" :class="activeTab === 'pesee' ? 'bg-indigo-600' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-4 py-2 rounded font-semibold text-sm transition">⚖️ Pesée & Inscriptions</button>
        <button @click="activeTab = 'tapis'" :class="activeTab === 'tapis' ? 'bg-indigo-600' : 'bg-indigo-800 hover:bg-indigo-700'" class="px-4 py-2 rounded font-semibold text-sm transition">🏟️ Gestion des Tapis</button>
      </nav>
    </header>

    <main class="p-6 max-w-7xl mx-auto">
      <!-- ONGLET 1 : PESÉE -->
      <div v-if="activeTab === 'pesee'" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-6 rounded-xl shadow border border-slate-200">
          <h2 class="text-lg font-bold text-indigo-900 mb-4">Saisie Pesée Officielle</h2>
          <form @submit.prevent="ajouterJudoka" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700">Nom & Prénom</label>
              <input v-model="newJudoka.nom" type="text" required class="w-full mt-1 p-2 border rounded-lg" placeholder="ex: MARTIN Léa" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Club</label>
              <input v-model="newJudoka.club" type="text" class="w-full mt-1 p-2 border rounded-lg" placeholder="ex: USPV Judo" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-sm font-medium text-slate-700">Sexe</label>
                <select v-model="newJudoka.sexe" class="w-full mt-1 p-2 border rounded-lg">
                  <option value="F">Féminin</option>
                  <option value="M">Masculin</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700">Catégorie</label>
                <select v-model="newJudoka.categorie" class="w-full mt-1 p-2 border rounded-lg">
                  <option>Poussins</option>
                  <option>Benjamins</option>
                  <option>Minimes</option>
                  <option>Cadets</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Poids réel (kg)</label>
              <input v-model="newJudoka.poids" type="number" step="0.1" required class="w-full mt-1 p-2 border rounded-lg" placeholder="ex: 46.2" />
            </div>
            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition">Enregistrer le combattant</button>
          </form>

          <div class="mt-8 pt-6 border-t border-slate-200">
            <h3 class="font-bold text-slate-700 mb-2">Fin de pesée & Génération</h3>
            <button @click="genererPoules" class="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg shadow transition">🚀 Générer les poules sur 5 Tapis</button>
          </div>
        </div>

        <div class="md:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-200">
          <h2 class="text-lg font-bold text-indigo-900 mb-4">Combattants Inscrits ({{ judokas.length }})</h2>
          <div class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-100 text-slate-600 text-sm">
                  <th class="p-3">Nom Prénom</th>
                  <th class="p-3">Club</th>
                  <th class="p-3">Sexe</th>
                  <th class="p-3">Catégorie</th>
                  <th class="p-3">Poids</th>
                  <th class="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 text-sm">
                <tr v-for="j in judokas" :key="j.id" class="hover:bg-slate-50">
                  <td class="p-3 font-semibold">{{ j.nom }}</td>
                  <td class="p-3">{{ j.club }}</td>
                  <td class="p-3">{{ j.sexe }}</td>
                  <td class="p-3">{{ j.categorie }}</td>
                  <td class="p-3 font-mono">{{ j.poids }} kg</td>
                  <td class="p-3 text-center">
                    <button @click="supprimerJudoka(j.id)" class="text-red-500 hover:text-red-700 font-bold">Supprimer</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ONGLET 2 : GESTION DES TAPIS -->
      <div v-if="activeTab === 'tapis'" class="space-y-6">
        <div class="flex justify-center gap-3">
          <button v-for="t in 5" :key="t" @click="selectedTapis = t" :class="selectedTapis === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'" class="px-6 py-3 rounded-xl font-bold transition">
            Tapis {{ t }}
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div v-for="poule in poulesDuTapis" :key="poule.id" class="bg-white p-5 rounded-xl shadow border border-slate-200 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded">Tapis {{ poule.tapis }}</span>
                <span class="text-sm font-semibold text-slate-500">{{ poule.combattants.length }} combattants</span>
              </div>
              <h3 class="font-bold text-lg text-slate-800 mb-3">{{ poule.nom }}</h3>
              <ul class="space-y-1 mb-4 text-sm">
                <li v-for="c in poule.combattants" :key="c.numero" class="text-slate-600">
                  <span class="font-bold text-slate-800">#{{ c.numero }}</span> {{ c.nomComplet }} <span class="text-xs text-slate-400">({{ c.poids }}kg)</span>
                </li>
              </ul>
            </div>
            <button @click="selectedPouleId = poule.id; activeTab = 'poule'" class="w-full bg-slate-900 hover:bg-indigo-600 text-white font-semibold py-2 rounded-lg transition text-center">Ouvrir la feuille de poule ➔</button>
          </div>
        </div>
      </div>

      <!-- ONGLET 3 : FEUILLE DE POULE INTERACTIVE -->
      <div v-if="activeTab === 'poule'" class="bg-white p-6 rounded-xl shadow border border-slate-200">
        <button @click="activeTab = 'tapis'" class="mb-4 text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Retour aux Tapis</button>
        
        <div v-for="poule in poules.filter(p => p.id === selectedPouleId)" :key="poule.id">
          <h2 class="text-2xl font-bold text-indigo-900 mb-6">{{ poule.nom }} (Tapis {{ poule.tapis }})</h2>

          <div class="overflow-x-auto mb-8">
            <table class="w-full border-collapse border border-slate-300 text-center text-sm">
              <thead>
                <tr class="bg-indigo-900 text-white">
                  <th class="p-3 border border-slate-300">Combattant</th>
                  <th v-for="c in poule.combattants" :key="c.numero" class="p-3 border border-slate-300">#{{ c.numero }}</th>
                  <th class="p-3 border border-slate-300 bg-emerald-700">Points</th>
                  <th class="p-3 border border-slate-300 bg-emerald-700">Victoires</th>
                  <th class="p-3 border border-slate-300 bg-amber-600">Place</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in calculerClassement(poule)" :key="c.numero">
                  <td class="p-3 border border-slate-300 text-left font-bold bg-slate-50">{{ c.nomComplet }}</td>
                  <td v-for="opp in poule.combattants.length" :key="opp" class="p-2 border border-slate-300">
                    <span v-if="opp === c.numero" class="text-slate-300 font-bold">X</span>
                    <input v-else v-model.number="c.scores[opp]" @input="mettreAJourScore(poule.id, c.numero, opp, c.scores[opp])" type="number" class="w-12 text-center p-1 border rounded font-bold" />
                  </td>
                  <td class="p-3 border border-slate-300 font-bold bg-emerald-50 text-emerald-800">{{ c.totalPoints }}</td>
                  <td class="p-3 border border-slate-300 font-bold bg-emerald-50 text-emerald-800">{{ c.victoires }}</td>
                  <td class="p-3 border border-slate-300 font-extrabold text-lg text-amber-700 bg-amber-50">
                    {{ calculerClassement(poule).findIndex(x => x.numero === c.numero) + 1 }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>