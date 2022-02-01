type GenericObject<T> = { [K in keyof T]: T[K] };

export type EmptyRecord = Record<string, undefined>;
export type GenericRecord<T> = GenericObject<T> | EmptyRecord;

export type AnyBasic = string | number | boolean | Error | Date;
export type AnyArray = Array<AnyBasic>;
export type AnyObject = { [x: string]: AnyBasic | AnyArray | AnyObject };
export type AnyType = AnyBasic | AnyArray | AnyObject;
