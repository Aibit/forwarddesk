export type Dir = 'export' | 'import';
export type Lang = 'en' | 'es' | 'fa';
export type Owner = 'sales' | 'ops' | 'customer' | 'agent' | 'line';

export interface StepDef {
  code: string;
  /** Short name as in the client's process map. */
  en: string;
  es: string;
  fa: string;
  /** Who does it (lane in the map). */
  who: Owner;
  /** Which of our teams holds the job at this step. */
  holder: 'sales' | 'ops';
  critical?: boolean;
}

// Step codes and names follow the client's process map (E1–E23, I1–I16).
export const EXPORT_STEPS: StepDef[] = [
  { code: 'E1', en: 'Find customers', es: 'Buscar clientes', fa: 'یافتن مشتری', who: 'sales', holder: 'sales' },
  { code: 'E2', en: 'Asks for a rate', es: 'Pide tarifa', fa: 'درخواست نرخ', who: 'customer', holder: 'sales' },
  { code: 'E3', en: 'Get best rate', es: 'Mejor tarifa de navieras', fa: 'گرفتن بهترین نرخ از خطوط', who: 'sales', holder: 'sales' },
  { code: 'E4', en: 'Send the quote', es: 'Enviar oferta', fa: 'ارسال پیشنهاد قیمت', who: 'sales', holder: 'sales' },
  { code: 'E5', en: 'Places order', es: 'Hace el pedido', fa: 'سفارش کانتینر', who: 'customer', holder: 'sales' },
  { code: 'E6', en: 'Book with line', es: 'Reservar con naviera', fa: 'بوکینگ با خط کشتیرانی', who: 'sales', holder: 'sales' },
  { code: 'E7', en: 'Confirms booking', es: 'Confirma la reserva', fa: 'تأیید بوکینگ', who: 'customer', holder: 'sales' },
  { code: 'E8', en: 'Fix free time', es: 'Fijar free time', fa: 'تعیین فری‌تایم', who: 'sales', holder: 'sales', critical: true },
  { code: 'E9', en: 'Asks for release order', es: 'Pide orden de entrega', fa: 'درخواست حواله تحویل کانتینر', who: 'customer', holder: 'sales' },
  { code: 'E10', en: 'Job to Ops', es: 'Pasa a Operaciones', fa: 'ارجاع به قسمت عملیات', who: 'sales', holder: 'ops' },
  { code: 'E11', en: 'Release order', es: 'Orden de entrega', fa: 'دریافت حواله از خط', who: 'ops', holder: 'ops' },
  { code: 'E12', en: 'Agent collects order and seals', es: 'Agente recoge orden y precintos', fa: 'تحویل حواله و پلمپ به ترخیص‌کار', who: 'customer', holder: 'ops' },
  { code: 'E13', en: 'Empty container set down at terminal', es: 'Vacío en terminal', fa: 'کانتینر خالی در ترمینال', who: 'customer', holder: 'ops' },
  { code: 'E14', en: 'Cargo loaded', es: 'Carga del contenedor', fa: 'بارگیری کالا', who: 'customer', holder: 'ops' },
  { code: 'E15', en: 'Customs filing', es: 'Declaración aduanera', fa: 'اظهار گمرکی', who: 'customer', holder: 'ops' },
  { code: 'E16', en: 'Customs check', es: 'Control aduanero', fa: 'بازرسی گمرک و پلمپ', who: 'line', holder: 'ops' },
  { code: 'E17', en: 'Papers to line', es: 'Papeles a la naviera', fa: 'تحویل اسناد به خط', who: 'customer', holder: 'ops' },
  { code: 'E18', en: 'Shipping order', es: 'Shipping order', fa: 'دستور حمل', who: 'customer', holder: 'ops', critical: true },
  { code: 'E19', en: 'Draft B/L', es: 'Borrador B/L', fa: 'درفت بارنامه', who: 'ops', holder: 'ops' },
  { code: 'E20', en: 'Checks draft', es: 'Revisa borrador', fa: 'بررسی و اصلاح درفت', who: 'customer', holder: 'ops' },
  { code: 'E21', en: 'Pays charges', es: 'Paga gastos', fa: 'پرداخت هزینه‌ها', who: 'customer', holder: 'ops', critical: true },
  { code: 'E22', en: 'Original B/L', es: 'B/L original', fa: 'اصل بارنامه', who: 'ops', holder: 'ops' },
  { code: 'E23', en: 'Docs to buyer', es: 'Documentos al comprador', fa: 'ارسال اسناد به خریدار', who: 'customer', holder: 'ops' },
];

export const IMPORT_STEPS: StepDef[] = [
  { code: 'I1', en: 'Find customers', es: 'Buscar clientes', fa: 'یافتن مشتری', who: 'sales', holder: 'sales' },
  { code: 'I2', en: 'Quote via agents', es: 'Cotizar vía agentes', fa: 'نرخ از نمایندگان', who: 'sales', holder: 'sales' },
  { code: 'I3', en: 'Accepts the rate', es: 'Acepta la tarifa', fa: 'پذیرش نرخ', who: 'customer', holder: 'sales' },
  { code: 'I4', en: 'Swap contacts', es: 'Intercambio de contactos', fa: 'تبادل اطلاعات تماس', who: 'sales', holder: 'sales' },
  { code: 'I5', en: 'Agent and seller coordinate', es: 'Agente y vendedor coordinan', fa: 'هماهنگی نماینده و فروشنده', who: 'agent', holder: 'ops' },
  { code: 'I6', en: 'Empty released', es: 'Vacío liberado', fa: 'ریلیز کانتینر خالی', who: 'agent', holder: 'ops' },
  { code: 'I7', en: 'Seller loads it', es: 'Vendedor carga', fa: 'بارگیری توسط فروشنده', who: 'agent', holder: 'ops' },
  { code: 'I8', en: 'First sailing', es: 'Primera salida', fa: 'اولین کشتی', who: 'agent', holder: 'ops' },
  { code: 'I9', en: 'Check draft B/L', es: 'Revisar borrador B/L', fa: 'بررسی درفت بارنامه', who: 'ops', holder: 'ops' },
  { code: 'I10', en: 'Arrival notice', es: 'Aviso de llegada', fa: 'آرایوال نوتیس', who: 'line', holder: 'ops' },
  { code: 'I11', en: 'Pay, get DO', es: 'Pagar, obtener DO', fa: 'پرداخت و دریافت دی‌او', who: 'ops', holder: 'ops' },
  { code: 'I12', en: 'Pays charges', es: 'Cliente paga gastos', fa: 'پرداخت هزینه‌ها توسط مشتری', who: 'customer', holder: 'ops' },
  { code: 'I13', en: 'Collect freight', es: 'Cobrar flete (collect)', fa: 'وصول کرایه کالکت', who: 'ops', holder: 'ops' },
  { code: 'I14', en: 'Clears customs', es: 'Despacha y devuelve vacío', fa: 'ترخیص و برگشت کانتینر خالی', who: 'customer', holder: 'ops', critical: true },
  { code: 'I15', en: 'Container back', es: 'Contenedor devuelto', fa: 'برگشت کانتینر و بررسی خسارت', who: 'line', holder: 'ops' },
  { code: 'I16', en: 'Cheques back', es: 'Cheques devueltos', fa: 'استرداد چک‌های تضمین', who: 'ops', holder: 'ops' },
];

export const PHASES: Record<Dir, { from: number; to: number; en: string; es: string; fa: string }[]> = {
  export: [
    { from: 1, to: 4, en: 'Win the job', es: 'Ganar el trabajo', fa: 'گرفتن کار' },
    { from: 5, to: 12, en: 'Book and release', es: 'Reservar y liberar', fa: 'بوکینگ و حواله' },
    { from: 13, to: 17, en: 'Load at terminal', es: 'Carga en terminal', fa: 'بارگیری در ترمینال' },
    { from: 18, to: 22, en: 'Bill of lading', es: 'Conocimiento de embarque', fa: 'بارنامه' },
    { from: 23, to: 23, en: 'Close', es: 'Cierre', fa: 'بستن پرونده' },
  ],
  import: [
    { from: 1, to: 4, en: 'Win the job', es: 'Ganar el trabajo', fa: 'گرفتن کار' },
    { from: 5, to: 9, en: 'Origin', es: 'Origen', fa: 'مبدأ' },
    { from: 10, to: 13, en: 'Arrival', es: 'Llegada', fa: 'رسیدن' },
    { from: 14, to: 16, en: 'Return and close', es: 'Devolución y cierre', fa: 'برگشت و بستن' },
  ],
};

export const stepsFor = (d: Dir) => (d === 'export' ? EXPORT_STEPS : IMPORT_STEPS);
export const stepIndex = (code: string) => Number(code.slice(1));
export const stepDef = (code: string) => stepsFor(code.startsWith('E') ? 'export' : 'import')[stepIndex(code) - 1];
