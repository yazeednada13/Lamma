import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { useCurrentAccount } from "@/features/auth";
import { useBusinessSettings, useBusinessTypes } from "@/features/settings";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useAddVariant, useCategories, useCreateProduct, useProduct, useProductTemplates, useRemoveProductImage, useUpdateProduct, useUploadProductImage } from "../api/catalogApi";
import type { ProductDetails } from "../api/catalogTypes";
import { BasicsSection } from "../components/BasicsSection";
import { ProductFormAside } from "../components/ProductFormAside";
import { TemplateFieldsSection } from "../components/TemplateFieldsSection";
import { TemplatePicker } from "../components/TemplatePicker";
import { VariantsSection } from "../components/VariantsSection";
import { combinations } from "../domain/catalogDomain";
import { createBody, emptyFormValues, existingVariants, formValuesFromProduct, newVariantBodies, templateAxes, updateBody } from "../domain/productFormModel";
import { productFormSchema, type ProductFormValues } from "../schemas/productFormSchema";

const FIELDS: FieldPath<ProductFormValues>[] = ["name", "sellingPrice", "cost", "lowStockThreshold", "expiryDate", "categoryId"];

/**
 * New product and edit product (prototype `#/products/new`). Owns loading, the form, the submit sequence
 * (product → new variants → image) and server-error mapping. Sections only render fields.
 */
export function ProductFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const account = useCurrentAccount();
  const templates = useProductTemplates();
  const categories = useCategories();
  const settings = useBusinessSettings();
  const businessTypes = useBusinessTypes();
  const product = useProduct(id);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const addVariant = useAddVariant();
  const upload = useUploadProductImage();
  const removeImage = useRemoveProductImage();
  const [image, setImage] = useState<File | null>(null);
  const [removeCurrentImage, setRemoveCurrentImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | undefined>();

  const businessType = businessTypes.data?.find((t) => t.code === account.business?.businessType);
  const initial = useMemo<ProductFormValues | null>(() => {
    if (!templates.data) return null;
    if (editing) return product.data ? formValuesFromProduct(product.data) : null;
    if (!settings.data || !businessTypes.data) return null;
    return emptyFormValues(templates.data.find((t) => t.code === businessType?.defaultTemplateCode) ?? templates.data[0], settings.data.defaultLowStockThreshold);
  }, [editing, templates.data, product.data, settings.data, businessTypes.data, businessType]);

  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema) });
  const { reset, handleSubmit, setError, setValue, formState, control } = form;
  useEffect(() => {
    if (initial) reset(initial);
  }, [initial, reset]);

  const templateCode = useWatch({ control, name: "templateCode" });
  const template = templates.data?.find((t) => t.code === templateCode);
  const saved: ProductDetails | undefined = editing ? product.data : undefined;
  const existing = saved ? existingVariants(saved) : undefined;
  const simpleStock = saved && saved.options.length === 0 ? saved.onHand : undefined;

  const chooseTemplate = (code: string) => {
    setValue("templateCode", code, { shouldDirty: true });
    // A new product follows the template's default axes until the merchant picks values.
    const untouched = combinations(form.getValues("axes")).length === 0;
    if (!editing && untouched) {
      setValue("axes", templateAxes(templates.data?.find((t) => t.code === code)));
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!template) return;
    setFormError(null);
    setImageError(undefined);
    try {
      let result: ProductDetails;
      if (saved) {
        result = await update.mutateAsync({ id: saved.id, body: updateBody(values, template, saved) });
        for (const body of newVariantBodies(values, template, saved)) {
          result = await addVariant.mutateAsync({ id: saved.id, body });
        }
      } else {
        result = await create.mutateAsync(createBody(values, template));
      }

      if (image) {
        try {
          await upload.mutateAsync({ id: result.id, file: image });
        } catch (error) {
          toast(`انحفظ المنتج بس الصورة ما انرفعت: ${errorMessage(error)}`);
        }
      } else if (removeCurrentImage && saved?.imageUrl) {
        await removeImage.mutateAsync(saved.id);
      }

      const variants = result.variants.filter((v) => !v.isDefault && !v.isArchived).length;
      toast(saved ? `انحفظت التعديلات على «${result.name}»` : `انضاف «${result.name}»${variants > 0 ? ` بـ ${variants} نسخة` : ""}`);
      navigate(`/products/${result.id}`);
    } catch (error) {
      setFormError(mapServerError(error, setError));
    }
  });

  const loadError = templates.error ?? categories.error ?? (editing ? product.error : (settings.error ?? businessTypes.error));
  if (loadError) {
    return (
      <>
        <PageHeader title={editing ? "تعديل المنتج" : "منتج جديد"} />
        <ErrorState message={errorMessage(loadError)} onRetry={() => void Promise.all([templates.refetch(), categories.refetch(), editing ? product.refetch() : settings.refetch()])} />
      </>
    );
  }

  if (!initial || !template || !categories.data || !formState.defaultValues) {
    return <PageSkeleton />;
  }

  const hasDetails = template.fields.length > 0 || template.supportsExpiry;
  const canChangeAxes = !saved || (saved.options.length === 0 && saved.onHand === 0 && saved.reserved === 0);
  return (
    <>
      <PageHeader
        title={saved ? `تعديل «${saved.name}»` : "منتج جديد"}
        subtitle={saved ? undefined : "اختار القالب، عبّي التفاصيل، وشوف المنتج وهو بيتكوّن"}
        crumbs={
          <>
            <Link to="/products">المنتجات</Link> / {saved ? <Link to={`/products/${saved.id}`}>{saved.name}</Link> : "منتج جديد"}
          </>
        }
      />
      <form className="grid g-main" style={{ gap: 20 }} onSubmit={onSubmit} noValidate>
        <div className="col" style={{ gap: 16 }}>
          {formError && <FormAlert>{formError}</FormAlert>}
          <TemplatePicker templates={templates.data!} value={templateCode} onChange={chooseTemplate} businessTypeLabel={saved ? undefined : businessType?.labelAr} />
          <BasicsSection form={form} categories={categories.data} />
          <TemplateFieldsSection form={form} template={template} />
          <VariantsSection
            form={form}
            number={hasDetails ? 4 : 3}
            template={template}
            existing={existing}
            canChangeAxes={canChangeAxes}
            axesLockedReason={saved && saved.options.length === 0 && !canChangeAxes ? "المنتج فيه مخزون، فما بتقدر تضيفله خيارات. أضف منتج جديد بالخيارات." : undefined}
            simpleStock={simpleStock}
          />
        </div>
        <ProductFormAside
          form={form}
          categories={categories.data}
          existing={existing}
          simpleStock={simpleStock}
          image={image}
          onImageChange={(file) => {
            setImage(file);
            setRemoveCurrentImage(false);
          }}
          currentImageUrl={removeCurrentImage ? null : (saved?.imageUrl ?? null)}
          onRemoveCurrentImage={saved?.imageUrl ? () => setRemoveCurrentImage(true) : undefined}
          imageError={imageError}
          saving={formState.isSubmitting}
          submitLabel={saved ? "احفظ التعديلات" : "حفظ المنتج"}
        />
      </form>
    </>
  );
}

/** Puts server field errors on the form (including `attributes.*` and `variants`); returns a form-level message otherwise. */
function mapServerError(error: unknown, setError: ReturnType<typeof useForm<ProductFormValues>>["setError"]): string | null {
  if (!(error instanceof ApiError)) return errorMessage(error);
  if (error.code === "category.not_found") {
    setError("categoryId", { type: "server", message: error.message });
    return null;
  }

  let matched = false;
  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    if (key.startsWith("attributes.")) {
      setError(key as FieldPath<ProductFormValues>, { type: "server", message });
      matched = true;
    } else if (key === "variants" || key.startsWith("options") || key === "optionNames") {
      setError("axes", { type: "server", message });
      matched = true;
    } else if ((FIELDS as string[]).includes(key)) {
      setError(key as FieldPath<ProductFormValues>, { type: "server", message });
      matched = true;
    }
  }

  return matched ? null : error.message;
}
