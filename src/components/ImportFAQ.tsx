import { MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export function ImportFAQ() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10" aria-labelledby="faq-title">
      <h2 id="faq-title" className="font-display text-2xl font-semibold">Import FAQ</h2>
      <Accordion type="single" collapsible className="mt-4">
        <AccordionItem value="time">
          <AccordionTrigger>Why does my app say “File expired” or “Failed to import”?</AccordionTrigger>
          <AccordionContent className="leading-relaxed text-muted-foreground">
            Open your phone’s Settings → Date and time, then enable automatic date and time from your network provider. Enable automatic time zone too, then try again if the link still has imports remaining. Incorrect phone time can affect a config’s validity; this does not restore an expired or used-up link. Check the link’s status above and request a new link if needed.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="root">
          <AccordionTrigger>Can I import on a rooted phone?</AccordionTrigger>
          <AccordionContent className="leading-relaxed text-muted-foreground">
            Some configs or importing apps block rooted phones. If yours has that restriction, use a non-rooted phone. This website cannot check whether your phone is rooted.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="burn">
          <AccordionTrigger>Why can I still use a config after its link burns?</AccordionTrigger>
          <AccordionContent className="leading-relaxed text-muted-foreground">
            Burn after 1 permits one download from this website, including repeat downloads by the same phone. An app may keep an already downloaded config and import or use that saved copy again without opening the link. Burning the link cannot erase a copy already on a phone. A failed import can still consume a download if the app fetched the file.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Questions? Contact Mr Frank.</p>
        <Button asChild variant="outline">
          <a href="https://wa.me/synapex" target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp support</a>
        </Button>
      </div>
    </section>
  );
}