import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoAdmin, jsonParaScript, origenPermitido, portadaExternaPermitida, rutaNormalizada } from '../src/lib/seguridad.ts';

test('el login conserva destinos internos y rechaza redirecciones externas o ambiguas', () => {
  assert.equal(destinoAdmin('/admin/ubicaciones?filtro=pendientes'), '/admin/ubicaciones?filtro=pendientes');
  for (const valor of ['https://evil.example', '//evil.example', '/\\evil.example', '/admin/../../fuera', '/administrator', '/admin/%2e%2e/otra', '/admin/%2f%2fevil.example', '/admin\r\nLocation: https://evil.example', null]) {
    assert.equal(destinoAdmin(valor), '/admin', String(valor));
  }
});

test('una sinopsis no puede cerrar el script JSON-LD ni inyectar HTML', () => {
  const datos = { titulo: '</script><img src=x onerror=alert(1)>', nota: '\u2028\u2029' };
  const json = jsonParaScript(datos);
  assert.equal(json.includes('<'), false);
  assert.deepEqual(JSON.parse(json), datos);
});

test('los POST del panel exigen el origen de la web, también cuando llevan JSON', () => {
  const peticion = (headers = {}) => new Request('https://catalogo.example/admin/guardar', { method: 'POST', headers });
  assert.equal(origenPermitido(peticion({ origin: 'https://catalogo.example' })), true);
  assert.equal(origenPermitido(peticion({ origin: 'https://catalogo.example.evil.example' })), false);
  assert.equal(origenPermitido(peticion({ origin: 'null' })), false);
  assert.equal(origenPermitido(peticion()), false);
  assert.equal(origenPermitido(peticion({ origin: 'https://catalogo.example', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(origenPermitido(peticion({ origin: 'https://publico.example' }), new URL('https://publico.example')), true);
});

test('las variantes codificadas del panel también pasan por la autenticación', () => {
  for (const ruta of ['/%61dmin/exportar', '/api/..%2fadmin/exportar', '//admin/exportar', '/admin%5cexportar']) {
    assert.equal(rutaNormalizada(ruta), '/admin/exportar');
  }
  assert.throws(() => rutaNormalizada('/admin/%00'));
  assert.throws(() => rutaNormalizada('/%zz'));
});

test('las portadas no permiten solicitar servicios internos ni hosts que imitan proveedores', () => {
  assert.equal(portadaExternaPermitida('https://covers.openlibrary.org/b/isbn/9780000000000-L.jpg'), true);
  assert.equal(portadaExternaPermitida('https://books.google.com/books/content?id=ejemplo'), true);
  for (const url of ['http://127.0.0.1', 'https://127.0.0.1', 'http://169.254.169.254/latest/meta-data/', 'https://localhost', 'https://covers.openlibrary.org.evil.example/a', 'https://covers.openlibrary.org@evil.example/a', 'https://covers.openlibrary.org:8443/a', 'file:///etc/passwd']) {
    assert.equal(portadaExternaPermitida(url), false, url);
  }
});
