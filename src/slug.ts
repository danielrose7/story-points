import { resolveLocale, type LocaleId } from './i18n';

/**
 * Room slugs are URLs (server enforces [a-z0-9-]), so every word list is
 * ASCII-safe by construction: no accents or umlauts — words that need them
 * don't make the list — and Japanese is romaji. Slugs generate in the
 * creator's language; for everyone else it's just the room's name.
 */
interface SlugWords {
	adjectives: string[];
	colors: string[];
	animals: string[];
}

const WORDS: Record<LocaleId, SlugWords> = {
	en: {
		adjectives: [
			'brave', 'calm', 'daring', 'eager', 'fancy', 'gentle', 'happy', 'jolly',
			'keen', 'lucky', 'mellow', 'nimble', 'plucky', 'quick', 'snappy', 'witty',
			'bold', 'merry', 'spry', 'sunny', 'swift', 'zesty',
		],
		colors: [
			'amber', 'aqua', 'blue', 'coral', 'crimson', 'gold', 'green', 'indigo',
			'ivory', 'jade', 'lime', 'magenta', 'navy', 'olive', 'pink', 'teal',
			'cherry', 'cobalt', 'copper', 'mint', 'plum', 'rust',
		],
		animals: [
			'badger', 'bison', 'crane', 'dingo', 'falcon', 'fox', 'gecko', 'heron',
			'ibex', 'koala', 'lemur', 'lynx', 'marmot', 'otter', 'panda', 'wombat',
			'alpaca', 'capybara', 'kestrel', 'newt', 'puffin', 'walrus',
		],
	},
	es: {
		adjectives: [
			'valiente', 'sereno', 'audaz', 'feliz', 'listo', 'amable', 'bravo', 'noble',
			'veloz', 'astuto', 'alegre', 'tenaz', 'sabio', 'firme', 'vivo', 'suave',
			'agudo', 'digno', 'gentil', 'jovial', 'pulcro', 'raudo',
		],
		colors: [
			'oro', 'azul', 'coral', 'jade', 'rosa', 'verde', 'anil', 'plata',
			'cobre', 'lima', 'marfil', 'oliva', 'vino', 'arena', 'perla', 'menta',
			'ocre', 'gris', 'salvia', 'trigo', 'canela', 'celeste',
		],
		animals: [
			'nutria', 'zorro', 'lince', 'panda', 'koala', 'puma', 'jaguar', 'llama',
			'lobo', 'oso', 'mono', 'pato', 'ciervo', 'gato', 'bisonte', 'iguana',
			'ardilla', 'capibara', 'tortuga', 'foca', 'erizo', 'alpaca',
		],
	},
	de: {
		adjectives: [
			'tapfer', 'ruhig', 'mutig', 'flink', 'froh', 'munter', 'schlau', 'witzig',
			'flott', 'sanft', 'wach', 'fix', 'brav', 'heiter', 'clever', 'wacker',
			'eifrig', 'zackig', 'rege', 'famos', 'gewitzt', 'hurtig',
		],
		colors: [
			'gold', 'blau', 'rot', 'rosa', 'mint', 'jade', 'indigo', 'ocker',
			'lila', 'beige', 'petrol', 'silber', 'kupfer', 'koralle', 'oliv', 'azur',
			'bernstein', 'smaragd', 'rubin', 'flieder', 'sand', 'schiefer',
		],
		animals: [
			'fuchs', 'otter', 'dachs', 'luchs', 'panda', 'koala', 'falke', 'reiher',
			'gecko', 'lemur', 'wombat', 'bison', 'kranich', 'igel', 'biber', 'marder',
			'eichhorn', 'robbe', 'storch', 'wiesel', 'hamster', 'alpaka',
		],
	},
	fr: {
		adjectives: [
			'brave', 'calme', 'agile', 'gai', 'malin', 'vif', 'doux', 'fier',
			'sage', 'hardi', 'leste', 'alerte', 'subtil', 'tenace', 'loyal', 'franc',
			'adroit', 'jovial', 'serein', 'preste', 'solide', 'vaillant',
		],
		colors: [
			'or', 'bleu', 'corail', 'jade', 'rose', 'vert', 'indigo', 'ivoire',
			'mauve', 'ocre', 'perle', 'rubis', 'ambre', 'menthe', 'sable', 'azur',
			'safran', 'sauge', 'prune', 'cuivre', 'argent', 'miel',
		],
		animals: [
			'renard', 'loutre', 'blaireau', 'lynx', 'panda', 'koala', 'faucon', 'castor',
			'bison', 'gecko', 'ibis', 'loup', 'ours', 'cerf', 'aigle', 'grue',
			'martre', 'phoque', 'cygne', 'mouflon', 'belette', 'alpaga',
		],
	},
	pt: {
		adjectives: [
			'bravo', 'calmo', 'feliz', 'esperto', 'veloz', 'sagaz', 'manso', 'forte',
			'leve', 'doce', 'firme', 'vivo', 'alegre', 'nobre', 'astuto', 'zeloso',
			'audaz', 'digno', 'gentil', 'jovial', 'faceiro', 'ligeiro',
		],
		colors: [
			'ouro', 'azul', 'coral', 'jade', 'rosa', 'verde', 'anil', 'prata',
			'cobre', 'lima', 'marfim', 'oliva', 'vinho', 'areia', 'cinza', 'menta',
			'ocre', 'castanho', 'dourado', 'grafite', 'celeste', 'canela',
		],
		animals: [
			'lontra', 'raposa', 'texugo', 'lince', 'panda', 'coala', 'tucano', 'arara',
			'tatu', 'capivara', 'mico', 'lobo', 'urso', 'veado', 'ema', 'quati',
			'esquilo', 'foca', 'tartaruga', 'arraia', 'jabuti', 'paca',
		],
	},
	ja: {
		// Romaji — slugs must be ASCII, and these stay easy to say aloud.
		adjectives: [
			'genki', 'hayai', 'tsuyoi', 'yasashii', 'akarui', 'shizuka', 'yukai', 'sunao',
			'tanoshii', 'kimama', 'nonbiri', 'majime', 'kashikoi', 'kibin', 'karui', 'yutaka',
			'atatakai', 'suzushii', 'mabushii', 'odayaka', 'hogaraka', 'subayai',
		],
		colors: [
			'kin', 'gin', 'aka', 'ao', 'midori', 'murasaki', 'momo', 'sora',
			'kon', 'beni', 'ruri', 'sango', 'cha', 'mizu', 'fuji', 'sakura',
			'matcha', 'kohaku', 'sumire', 'yamabuki', 'shu', 'ai',
		],
		animals: [
			'kitsune', 'usagi', 'tanuki', 'kuma', 'tora', 'taka', 'tsuru', 'kame',
			'saru', 'neko', 'inu', 'risu', 'kawauso', 'shika', 'panda', 'koara',
			'koi', 'tsubame', 'fukurou', 'hitsuji', 'uma', 'kaba',
		],
	},
};

function pick(list: string[]): string {
	return list[crypto.getRandomValues(new Uint32Array(1))[0] % list.length];
}

export function generateRoomSlug(): string {
	const words = WORDS[resolveLocale()] ?? WORDS.en;
	return `${pick(words.adjectives)}-${pick(words.colors)}-${pick(words.animals)}`;
}
