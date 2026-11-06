import { greet } from '@bright-trail/shared';
import { formatGreeting } from './format';

const name = process.argv[2] ?? 'explorer';
console.log(formatGreeting(greet(name)));
