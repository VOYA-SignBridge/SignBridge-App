import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tnhuyixiabldstcsawmz.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuaHV5aXhpYWJsZHN0Y3Nhd216Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTIyNjQsImV4cCI6MjA4NTMyODI2NH0.WeHNvSFEt-f9J46iuM4UuBdVoj-m5uppuh23pi3VVX8";
//  const supabaseUrl = "https://lamfiemxymcxtvvohswr.supabase.co"
//  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhbWZpZW14eW1jeHR2dm9oc3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDA1NTYsImV4cCI6MjA3ODE3NjU1Nn0.LVWxgPLC9V1nCnRSi5q0QZrDFZRswROnJ7y5Ri9F8L0"

export const supabase = createClient(supabaseUrl, supabaseAnonKey);