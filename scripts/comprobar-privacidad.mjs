import { execFileSync } from 'node:child_process';

const staged = process.argv.includes('--staged');
const args = staged ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'] : ['ls-files', '-z'];
const archivos = execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
const privados = archivos.filter((p) => /(^|\/)(ESTADO_DEL_PROYECTO\.md|otros-objetos\.csv|datos-privados|copias)(\/|$)/i.test(p) ||
  /(^|\/)\.env(?:\..*)?$/.test(p) && !p.endsWith('/.env.example') && p !== '.env.example' || /\.bundle$/i.test(p));
if (privados.length) {
  console.error('No se deben publicar inventarios, notas personales, claves ni copias privadas:\n' + privados.join('\n'));
  process.exitCode = 1;
} else {
  console.log('No hay archivos privados conocidos entre los archivos que se van a publicar.');
}
