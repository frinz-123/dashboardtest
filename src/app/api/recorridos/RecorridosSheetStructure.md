//Clientes_Rutas
Nombre(A) Latitude(B) Longitud(C) Dia(D) Frecuencia(E) Tipo_Cliente(F) Vendedor(G) Entrega(H)

//Rutas_Performance
fecha(A)	dia_ruta(b)	vendedor(c)	clientes_programados(D)	clientes_visitados(E)	ventas_totales(F)	tiempo_inicio(G)	tiempo_fin(H)	kilometros_recorridos(I)	combustible_gastado(J)	observaciones(K)

//Programacion_Semanal
semana_numero(A)	fecha_inicio(B)	dia_semana(C)	cliente_nombre(D)	vendedor(E)	ultima_visita(F)	proxima_visita_programada(G)	estado(H)	orden_visita(I)

//Metricas_Rutas
id_visita(A)	vendedor(B)	cliente(C)	fecha(D)	dia_ruta(E)	tipo_visita(F)	semana(G)	timestamp(H)	notas(I)	latitud(J)	longitude(K)

//Configuracion
parametro(A) valor(B) descripcion(C)

//Visitas_Reprogramadas
cliente_original(A) | tipo_visita(B) | dia_original(C) | dia_nuevo(D) | fecha_reprogramacion(E) | vendedor(F) | activo(G)