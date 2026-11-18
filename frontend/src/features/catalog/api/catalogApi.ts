import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api/apiClient";
import type {
  AddVariantBody,
  Category,
  CreateProductBody,
  Paged,
  ProductDetails,
  ProductListItem,
  ProductListParams,
  ProductTemplate,
  TemplateField,
  TemplateFieldBody,
  UpdateProductBody,
  UpdateVariantBody,
} from "./catalogTypes";

export const catalogKeys = {
  all: ["catalog"] as const,
  categories: ["catalog", "categories"] as const,
  templates: ["catalog", "templates"] as const,
  products: ["catalog", "products"] as const,
  productList: (params: ProductListParams) => ["catalog", "products", "list", params] as const,
  product: (id: string) => ["catalog", "products", "detail", id] as const,
};

function query(params: ProductListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      search.set(key, String(value));
    }
  }

  const text = search.toString();
  return text ? `?${text}` : "";
}

// ---------- Queries ----------

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: () => api.get<Category[]>("/categories") });
}

export function useProductTemplates() {
  return useQuery({ queryKey: catalogKeys.templates, queryFn: () => api.get<ProductTemplate[]>("/product-templates"), staleTime: 5 * 60_000 });
}

export function useProducts(params: ProductListParams) {
  return useQuery({
    queryKey: catalogKeys.productList(params),
    queryFn: () => api.get<Paged<ProductListItem>>(`/products${query(params)}`),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: catalogKeys.product(id ?? ""), queryFn: () => api.get<ProductDetails>(`/products/${id}`), enabled: Boolean(id) });
}

// ---------- Mutations ----------

/** After any product change: store the returned details and refresh lists and category counts. */
function useProductMutation<TArgs>(mutationFn: (args: TArgs) => Promise<ProductDetails>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (product) => {
      queryClient.setQueryData(catalogKeys.product(product.id), product);
      void queryClient.invalidateQueries({ queryKey: [...catalogKeys.products, "list"] });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.categories });
    },
  });
}

export function useCreateProduct() {
  return useProductMutation((body: CreateProductBody) => api.post<ProductDetails>("/products", body));
}

export function useUpdateProduct() {
  return useProductMutation(({ id, body }: { id: string; body: UpdateProductBody }) => api.put<ProductDetails>(`/products/${id}`, body));
}

export function useSetProductArchived() {
  return useProductMutation(({ id, archived }: { id: string; archived: boolean }) => api.post<ProductDetails>(`/products/${id}/${archived ? "archive" : "restore"}`));
}

export function useAddVariant() {
  return useProductMutation(({ id, body }: { id: string; body: AddVariantBody }) => api.post<ProductDetails>(`/products/${id}/variants`, body));
}

export function useUpdateVariant() {
  return useProductMutation(({ id, variantId, body }: { id: string; variantId: string; body: UpdateVariantBody }) =>
    api.put<ProductDetails>(`/products/${id}/variants/${variantId}`, body),
  );
}

export function useSetVariantArchived() {
  return useProductMutation(({ id, variantId, archived }: { id: string; variantId: string; archived: boolean }) =>
    api.post<ProductDetails>(`/products/${id}/variants/${variantId}/${archived ? "archive" : "restore"}`),
  );
}

export function useUploadProductImage() {
  return useProductMutation(({ id, file }: { id: string; file: File }) => {
    const form = new FormData();
    form.append("file", file);
    return api.upload<ProductDetails>(`/products/${id}/image`, form);
  });
}

export function useRemoveProductImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/products/${id}/image`),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.product(id) });
      void queryClient.invalidateQueries({ queryKey: [...catalogKeys.products, "list"] });
    },
  });
}

export function useSaveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) => (id ? api.put<Category>(`/categories/${id}`, { name }) : api.post<Category>("/categories", { name })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogKeys.categories });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.products }); // category names appear on products
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/categories/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKeys.categories }),
  });
}

export function useSaveTemplateField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateCode, key, body }: { templateCode: string; key?: string; body: TemplateFieldBody }) =>
      key ? api.put<TemplateField>(`/product-templates/${templateCode}/fields/${key}`, body) : api.post<TemplateField>(`/product-templates/${templateCode}/fields`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKeys.templates }),
  });
}

export function useDeleteTemplateField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateCode, key }: { templateCode: string; key: string }) => api.delete<void>(`/product-templates/${templateCode}/fields/${key}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKeys.templates }),
  });
}
