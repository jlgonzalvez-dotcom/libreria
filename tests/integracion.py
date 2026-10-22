import re
from pathlib import Path
import tempfile
from html.parser import HTMLParser
import http.server, threading, subprocess, socket, os, time, urllib.request, urllib.parse, urllib.error, json, signal

ROOT = str(Path(__file__).resolve().parents[1])
row = {
 'id':'00000000-0000-4000-8000-000000000001','slug':'libro-de-prueba','titulo':'Libro de prueba </script><img src=x onerror=alert(1)>',
 'autor':'Autor de prueba','autores_extra':[],'categoria':'Ensayo','subcategorias':[],'etiquetas':[],
 'anio':2020,'anio_publicacion':2020,'idioma':'Español','editorial':None,'edicion':None,'isbn':None,
 'paginas':100,'formato':'papel','portada':None,'sinopsis':'Sinopsis de prueba','sinopsis_en':'Test synopsis',
 'valoracion':4,'destacado':False,'en_venta':False,'precio':None,'estado_conservacion':None,
 'updated_at':'2026-01-01T00:00:00Z','created_at':'2026-01-01T00:00:00Z','estado':'pendiente',
 'ubicacion':'UBICACION_PRIVADA_FICTICIA','prestado_a':'PERSONA_PRIVADA_FICTICIA','prestado_en':None,
 'notas':'NOTA_PRIVADA_FICTICIA','resena':None,'sinopsis_borrador':None,'sinopsis_en_de':None,'ejemplares':1,
}
queries = []
class Database(http.server.BaseHTTPRequestHandler):
 def log_message(self, *args): pass
 def do_GET(self):
  url=urllib.parse.urlparse(self.path)
  fields=urllib.parse.parse_qs(url.query).get('select',['*'])[0]
  queries.append(fields)
  data=row if fields=='*' else {k:row[k] for k in fields.split(',') if k in row}
  body=json.dumps([data]).encode()
  self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
db=http.server.ThreadingHTTPServer(('127.0.0.1',0),Database)
threading.Thread(target=db.serve_forever,daemon=True).start()
with socket.socket() as s:
 s.bind(('127.0.0.1',0));port=s.getsockname()[1]
base=f'http://127.0.0.1:{port}'
env=os.environ.copy()
env.update(SUPABASE_URL=f'http://127.0.0.1:{db.server_port}',SUPABASE_SERVICE_ROLE_KEY='local-test-key-not-a-real-secret',ADMIN_PASSWORD='local-password-not-used-in-production',AUTH_SECRET='local-signing-secret-not-used-in-production')
for key in ['ANTHROPIC_API_KEY','GOOGLE_BOOKS_API_KEY','CRON_SECRET']:env.pop(key,None)
log=tempfile.TemporaryFile(mode='w+')
app=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port',str(port),'--ignore-lock'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
client=urllib.request.build_opener(NoRedirect)
def request(path,body=None,headers=None):
 req=urllib.request.Request(base+path,data=body,headers={'User-Agent':'node-test',**(headers or {})})
 try:res=client.open(req,timeout=10)
 except urllib.error.HTTPError as error:res=error
 return res.status,res.headers,res.read().decode()
checks=[]
try:
 for attempt in range(200):
  if app.poll() is not None:raise RuntimeError('Astro terminó antes de arrancar')
  try:
   status,_,_=request('/admin/login')
   if status==200:break
  except (OSError,urllib.error.URLError):pass
  time.sleep(0.1)
 else:raise RuntimeError('Astro no arrancó a tiempo')
 for path in ['/','/en/','/libros/libro-de-prueba/','/en/libros/libro-de-prueba/']:
  status,_,html=request(path)
  assert status==200,(path,status)
  assert not any(x in html for x in ['UBICACION_PRIVADA_FICTICIA','PERSONA_PRIVADA_FICTICIA','NOTA_PRIVADA_FICTICIA'])
  class Html(HTMLParser):
   def handle_starttag(self,tag,attrs):
    assert not (tag=='img' and any(k=='onerror' for k,v in attrs)), 'HTML ejecutable inyectado'
  Html().feed(html)
  for script in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',html,re.S):
   json.loads(script)
   assert '<' not in script

  checks.append('Catálogo público sin datos internos: '+path)
 assert all(q!='*' and 'ubicacion' not in q and 'notas' not in q and 'prestado_a' not in q for q in queries),queries
 checks.append('Las consultas públicas no solicitan campos privados')
 status,headers,_=request('/admin/exportar');assert status in [302,303] and headers['Location'].startswith('/admin/login')
 checks.append('Exportación denegada sin sesión')
 body=urllib.parse.urlencode({'password':env['ADMIN_PASSWORD'],'volver':'//evil.example'}).encode()
 status,_,_=request('/admin/login',body,{'Origin':'https://evil.example','Content-Type':'application/x-www-form-urlencoded'});assert status==403,status
 checks.append('Login desde otra web bloqueado')
 status,headers,_=request('/admin/login',body,{'Origin':base,'Content-Type':'application/x-www-form-urlencoded'})
 assert status in [302,303] and headers['Location']=='/admin',(status,headers.get('Location'))
 cookie=headers['Set-Cookie'].split(';')[0]
 assert 'HttpOnly' in headers['Set-Cookie'] and 'SameSite=Lax' in headers['Set-Cookie']
 checks.append('Login válido y redirección externa bloqueada')
 status,headers,html=request('/admin',headers={'Cookie':cookie})
 assert status==200 and 'no-store' in headers.get('Cache-Control','') and 'UBICACION_PRIVADA_FICTICIA' in html
 checks.append('Inventario disponible únicamente con sesión y sin caché')
 status,_,_=request('/admin/ubicar',json.dumps({'id':row['id'],'ubicacion':'prueba'}).encode(),{'Origin':'https://evil.example','Content-Type':'application/json','Cookie':cookie})
 assert status==403,status
 checks.append('Modificación JSON desde otra web bloqueada')
 print(json.dumps({'resultado':'correcto','comprobaciones':checks},ensure_ascii=False))
finally:
 if app.poll() is None: os.killpg(app.pid,signal.SIGTERM)
 app.wait(timeout=10);db.shutdown();log.close()
