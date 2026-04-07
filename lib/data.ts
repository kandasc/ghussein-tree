export interface Member {
  id: number;
  name: string;
  gender: 'M' | 'F' | '';
  birth: string;
  birthPlace: string;
  dead: boolean;
  deathInfo?: string;
  parents: number[];
  children: number[];
  spouses: number[];
  note?: string;
}

export const initialMembers: Member[] = [
  // G1 – Fondateurs
  { id:1, name:'GHUSSEIN Ismael', gender:'M', birth:'11/01/1936', birthPlace:'Dabola', dead:true, deathInfo:'11/01/2016 à Toulouse', parents:[], children:[5,6,7,8,9,10,11], spouses:[2], note:"Fils de GHUSSEIN Mohamed Gassim et CAMARA N'Gamma" },
  { id:2, name:'BARRY Raymonde', gender:'F', birth:'12/06/1939', birthPlace:'Conakry', dead:false, parents:[], children:[5,6,7,8,9,10,11], spouses:[1], note:"Fille de BARRY Madiou (1904, Pita – déc. 03/10/1954) et ROMAGE Hélène" },
  // G2 – Enfants
  { id:5, name:'GHUSSEIN Marie-Hélène', gender:'F', birth:'26/09/1960', birthPlace:'Dabola', dead:false, parents:[1,2], children:[21,22,23,24,25], spouses:[30] },
  { id:6, name:'GHUSSEIN Kadija', gender:'F', birth:'22/07/1962', birthPlace:'Dabola', dead:false, parents:[1,2], children:[31], spouses:[] },
  { id:7, name:'GHUSSEIN Mohamed', gender:'M', birth:'04/04/1964', birthPlace:'Le Caire', dead:true, deathInfo:'25/11/2013 à Conakry', parents:[1,2], children:[33,34], spouses:[32] },
  { id:8, name:'GHUSSEIN Zeinab', gender:'F', birth:'28/07/1965', birthPlace:'Le Caire', dead:false, parents:[1,2], children:[36,37], spouses:[38] },
  { id:9, name:'GHUSSEIN Fadel', gender:'M', birth:'03/08/1969', birthPlace:'Fria', dead:false, parents:[1,2], children:[39], spouses:[40] },
  { id:10, name:'GHUSSEIN Madiou', gender:'M', birth:'13/06/1972', birthPlace:'', dead:false, parents:[1,2], children:[], spouses:[] },
  { id:11, name:'GHUSSEIN Moustapha', gender:'M', birth:'10/11/1974', birthPlace:'', dead:false, parents:[1,2], children:[41,42,43], spouses:[] },
  // G2 – Conjoints
  { id:30, name:'BAH Tanou', gender:'M', birth:'', birthPlace:'', dead:false, parents:[], children:[21,22,23,24,25], spouses:[5] },
  { id:32, name:'KOUYATE Assiatou', gender:'F', birth:'09/05/1970', birthPlace:'Conakry', dead:false, parents:[], children:[33,34], spouses:[7] },
  { id:38, name:'AGBOKOU Jean Jacques', gender:'M', birth:'', birthPlace:'', dead:false, parents:[], children:[36,37], spouses:[8] },
  { id:40, name:'ROUX Alexandrine', gender:'F', birth:'04/11/1972', birthPlace:'Toulouse', dead:false, parents:[], children:[39], spouses:[9] },
  // G3 – Petits-enfants BAH
  { id:21, name:'BAH Ismael', gender:'M', birth:'10/12/1997', birthPlace:'Conakry', dead:false, parents:[5,30], children:[], spouses:[] },
  { id:22, name:'BAH Safiatou', gender:'F', birth:'06/10/1982', birthPlace:'Conakry', dead:false, parents:[5,30], children:[], spouses:[] },
  { id:23, name:'BAH Raymonde', gender:'F', birth:'04/02/1985', birthPlace:'Conakry', dead:false, parents:[5,30], children:[], spouses:[] },
  { id:24, name:'BAH Hervé Vincent', gender:'M', birth:'23/08/1986', birthPlace:'Conakry', dead:false, parents:[5,30], children:[], spouses:[] },
  { id:25, name:'BAH Lansana', gender:'M', birth:'27/08/2001', birthPlace:'Conakry', dead:false, parents:[5,30], children:[], spouses:[] },
  // G3 – Kadija
  { id:31, name:'MIGAN VIGNON Bruno Ismael', gender:'M', birth:'11/12/1995', birthPlace:'Toulouse', dead:false, parents:[6], children:[], spouses:[] },
  // G3 – Mohamed + Assiatou
  { id:33, name:'GHUSSEIN Iman Kadyja Victoria', gender:'F', birth:'11/01/1998', birthPlace:'Villepinte', dead:false, parents:[7,32], children:[], spouses:[] },
  { id:34, name:'GHUSSEIN Jasmine Raymonde', gender:'F', birth:'16/06/2007', birthPlace:'Paris 15', dead:false, parents:[7,32], children:[], spouses:[] },
  // G3 – Zeinab + Jean Jacques
  { id:36, name:'GARBA GHUSSEIN Zouena Sarah', gender:'F', birth:'', birthPlace:'', dead:false, parents:[8,38], children:[], spouses:[] },
  { id:37, name:'GHUSSEIN Charlène', gender:'F', birth:'08/03/1998', birthPlace:'Toulouse', dead:false, parents:[8,38], children:[], spouses:[] },
  // G3 – Fadel + Alexandrine
  { id:39, name:'PERMAL GHUSSEIN Luciana', gender:'F', birth:'01/07/1993', birthPlace:'Toulouse', dead:false, parents:[9,40], children:[], spouses:[] },
  // G3 – Moustapha
  { id:41, name:'GHUSSEIN Mathéo Alain Bruno Gassim', gender:'M', birth:'26/02/2000', birthPlace:'Toulouse', dead:false, parents:[11], children:[], spouses:[] },
  { id:42, name:'GHUSSEIN Brice Étienne Ismael', gender:'M', birth:'06/08/2002', birthPlace:'Toulouse', dead:false, parents:[11], children:[], spouses:[] },
  { id:43, name:'GHUSSEIN Jade Raymonde Michelle', gender:'F', birth:'27/04/2009', birthPlace:'Toulouse', dead:false, parents:[11], children:[], spouses:[] },
];
