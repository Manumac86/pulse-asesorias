'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Loader2, FileText } from 'lucide-react';

interface Fuente {
  docId: string;
  tipo: string;
  fecha: string;
  titulo: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  fuentes?: Fuente[];
}

interface ChatSoporteProps {
  asesoriaId: number;
}

const tipoBadgeColor: Record<string, string> = {
  chat: 'bg-blue-100 text-blue-800',
  nota_interna: 'bg-purple-100 text-purple-800',
  ticket: 'bg-amber-100 text-amber-800',
  email: 'bg-green-100 text-green-800',
};

export function ChatSoporte({ asesoriaId }: ChatSoporteProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput('');
    setError(null);

    // Anadir mensaje del usuario
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const result = await api<{ respuesta: string; fuentes: Fuente[] }>(
        `/api/asesorias/${asesoriaId}/soporte/query`,
        {
          method: 'POST',
          body: JSON.stringify({ pregunta: question }),
        },
      );

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.respuesta, fuentes: result.fuentes },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="h-4 w-4" />
          Soporte asistido
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Mensajes */}
        <div className="mb-4 max-h-96 space-y-4 overflow-y-auto">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Pregunta sobre esta asesoría. Por ejemplo: &quot;¿Qué incidencias recurrentes
              tiene?&quot; o &quot;Resume los problemas con IVA&quot;.
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Fuentes citadas */}
                {msg.fuentes && msg.fuentes.length > 0 && (
                  <div className="mt-3 border-t border-border/50 pt-2">
                    <p className="mb-1.5 text-xs font-medium opacity-70">Fuentes:</p>
                    <div className="space-y-1.5">
                      {msg.fuentes.map((f) => (
                        <div
                          key={f.docId}
                          className="flex items-start gap-2 rounded bg-background/50 p-2 text-xs"
                        >
                          <FileText className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                          <div>
                            <span className="font-mono font-medium">{f.docId}</span>
                            <span className="mx-1.5 opacity-30">·</span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${tipoBadgeColor[f.tipo] || ''}`}
                            >
                              {f.tipo}
                            </Badge>
                            <span className="mx-1.5 opacity-30">·</span>
                            <span className="opacity-70">
                              {new Date(f.fecha).toLocaleDateString('es-ES')}
                            </span>
                            <p className="mt-0.5 opacity-80">{f.titulo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando en documentos de soporte...
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre esta asesoría..."
            disabled={loading}
          />
          <Button type="submit" size="sm" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
