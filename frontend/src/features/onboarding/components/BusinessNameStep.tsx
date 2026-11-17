import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/form/TextField";

interface BusinessNameStepProps {
  ownerName: string;
  name: string;
  error?: string;
  onNameChange: (name: string) => void;
  onContinue: () => void;
}

/** Step 1: the business name (currency is fixed to JOD). */
export function BusinessNameStep({ ownerName, name, error, onNameChange, onContinue }: BusinessNameStepProps) {
  return (
    <section className="onb__card">
      <h1>أهلًا {ownerName}! شو اسم مشروعك؟</h1>
      <p className="onb__sub">الاسم اللي بيعرفك فيه زباينك. بتقدر تغيّره بعدين من الإعدادات.</p>
      <form
        className="grid g-2"
        style={{ marginTop: 18 }}
        onSubmit={(event) => {
          event.preventDefault();
          onContinue();
        }}
        noValidate
      >
        <TextField label="اسم المشروع" required value={name} onChange={(e) => onNameChange(e.target.value)} error={error} placeholder="مثلًا: بوتيك ريم" autoFocus />
        <TextField label="العملة" value="دينار أردني (د.أ)" readOnly disabled help="لمّة بتشتغل بالدينار الأردني" />
        <div className="row" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
          <Button type="submit" size="lg" className="end" iconEnd="arrow-left">
            متابعة
          </Button>
        </div>
      </form>
    </section>
  );
}
