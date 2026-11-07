import 'fake-indexeddb/auto';
import { i18n } from './src/lib/i18n.svelte';

// Tests read English texts, whatever language the machine runs in.
i18n.lang = 'en';
