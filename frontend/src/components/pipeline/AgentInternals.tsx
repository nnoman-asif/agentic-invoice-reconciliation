import { Code2, FileInput, FileOutput, BookOpen } from "lucide-react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import type { AgentStage, AgentStageState } from "@/hooks/useLivePipeline"

const SYSTEM_PROMPTS: Record<AgentStage, string> = {
  parser: `You are an invoice data extraction specialist. Given the raw text of an invoice document, extract all relevant structured information.

You MUST respond with valid JSON only. No additional text or explanation.

Extract: invoice_number, vendor_name, vendor_tax_id, po_reference, invoice_date,
due_date, total_amount, tax_amount, currency, line_items.

Rules:
- Extract ALL line items found in the invoice
- If a field is not found in the document, set it to null
- Amounts must be plain numbers without currency symbols
- Dates must be in YYYY-MM-DD format
- Be precise with quantities and prices`,

  matcher: `Tool-driven agent. The matcher is deterministic, not LLM-based.

Pseudocode:
1. Resolve vendor by tax_id or fuzzy name match
2. If po_reference is present, look up PO directly
3. Otherwise, fuzzy match by vendor + amount range
4. Find delivery receipts for matched PO
5. For each invoice line, find best matching PO line via:
   - Exact item_code match
   - Embedding-based description similarity (Qwen3-Embedding 1024d)
6. Compare quantities (invoiced vs ordered vs delivered)
7. Compute price deviation percentage
8. Classify each line as: matched / partial / mismatch / unmatched`,

  anomaly: `Pure rule-based engine. No LLM.

Runs 8 deterministic checks:
1. Duplicate invoice (same invoice_number exists)
2. Unauthorized vendor (vendor not registered)
3. Missing PO (no purchase order match found)
4. Missing receipt (no delivery receipt for any line)
5. Price deviation (> threshold % from PO)
6. Quantity mismatch (invoiced != delivered)
7. Date anomaly (invoice date before PO issue date)
8. Amount exceeds PO total

Each anomaly is tagged with severity (critical / warning / info).`,

  resolution: `You are a financial reconciliation expert. Given an invoice reconciliation summary and any similar past cases, provide a clear recommendation.

You MUST respond with valid JSON only:
{
  "recommendation": "approve" or "reject" or "review",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of your recommendation"
}

Guidelines:
- "approve": No significant issues, safe to pay
- "review": Has issues that need human judgment
- "reject": Clear violations (duplicates, unauthorized vendors, major discrepancies)
- Higher confidence = more certain about the recommendation
- Reference similar past cases (RAG-retrieved) if provided`,
}

interface Props {
  stage: AgentStageState
}

export function AgentInternals({ stage }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Tabs defaultValue="prompt" className="w-full">
          <div className="px-6 pt-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">{stage.label} Agent</h3>
              <p className="text-sm text-muted-foreground">
                {stage.description}
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="prompt">
                <BookOpen className="size-3.5" />
                Prompt
              </TabsTrigger>
              <TabsTrigger value="input">
                <FileInput className="size-3.5" />
                Input
              </TabsTrigger>
              <TabsTrigger value="output">
                <FileOutput className="size-3.5" />
                Output
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="prompt" className="p-0 m-0">
            <CodeBlock
              label="System prompt"
              content={SYSTEM_PROMPTS[stage.id]}
            />
          </TabsContent>

          <TabsContent value="input" className="p-0 m-0">
            <CodeBlock
              label="Last input"
              content={
                stage.output
                  ? "[See live data in pipeline state]\n\nThis is the data structure passed in:\n" +
                    JSON.stringify(getStageInputShape(stage.id), null, 2)
                  : "Awaiting execution…"
              }
            />
          </TabsContent>

          <TabsContent value="output" className="p-0 m-0">
            <CodeBlock
              label="Last output"
              content={
                stage.output
                  ? JSON.stringify(stage.output, null, 2)
                  : "Awaiting execution…"
              }
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function CodeBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="border-t border-border/60 m-6 mt-4 rounded-lg bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-muted/40">
        <Code2 className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed max-h-80">
        {content}
      </pre>
    </div>
  )
}

function getStageInputShape(stage: AgentStage): Record<string, unknown> {
  switch (stage) {
    case "parser":
      return {
        invoice_id: "uuid",
        raw_file_path: "uploads/invoices/<uuid>.pdf",
        file_content_type: "application/pdf",
      }
    case "matcher":
      return {
        invoice_number: "string | null",
        vendor_name: "string | null",
        vendor_tax_id: "string | null",
        po_reference: "string | null",
        line_items: "Array<{ description, quantity, unit_price, ... }>",
      }
    case "anomaly":
      return {
        line_item_matches: "Array<LineItemMatch>",
        matched_po: "PurchaseOrder | null",
        vendor_found: "boolean",
        is_duplicate: "boolean",
      }
    case "resolution":
      return {
        discrepancies: "Array<Discrepancy>",
        similar_cases: "Array<RAGCase>",
        line_item_matches: "Array<LineItemMatch>",
      }
  }
}
