
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "accommodation_participants": {
                  Row: {
                    "accommodation_id": string,"created_at": string,"traveler_id": string,"trip_id": string
                  }
                  Insert: {
                    "accommodation_id": string,"created_at"?: string,"traveler_id": string,"trip_id": string
                  }
                  Update: {
                    "accommodation_id"?: string,"created_at"?: string,"traveler_id"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accommodation_participants_trip_id_accommodation_id_fkey"
      columns: ["trip_id","accommodation_id"]
isOneToOne: false
      referencedRelation: "accommodations"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "accommodation_participants_trip_id_traveler_id_fkey"
      columns: ["trip_id","traveler_id"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    }
                  ]
                },"accommodations": {
                  Row: {
                    "address": string | null,"booking_ref": string | null,"booking_status": string,"booking_url": string | null,"check_in_at": string,"check_out_at": string,"cost_amount": number | null,"cost_currency": string | null,"created_at": string,"created_by": string | null,"google_place_id": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"timezone": string,"trip_id": string,"trip_stop_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"booking_ref"?: string | null,"booking_status"?: string,"booking_url"?: string | null,"check_in_at": string,"check_out_at": string,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"timezone": string,"trip_id": string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"booking_ref"?: string | null,"booking_status"?: string,"booking_url"?: string | null,"check_in_at"?: string,"check_out_at"?: string,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"timezone"?: string,"trip_id"?: string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accommodations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "accommodations_stop_same_trip"
      columns: ["trip_id","trip_stop_id"]
isOneToOne: false
      referencedRelation: "trip_stops"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "accommodations_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"activities": {
                  Row: {
                    "address": string | null,"booking_status": string,"category": string,"cost_amount": number | null,"cost_currency": string | null,"created_at": string,"created_by": string | null,"duration_minutes": number,"external_url": string | null,"google_place_id": string | null,"id": string,"lat": number | null,"lng": number | null,"location_name": string | null,"notes": string | null,"reservation_ref": string | null,"saved_place_id": string | null,"starts_at": string,"timezone": string,"title": string,"travel_mode": string | null,"trip_id": string,"trip_stop_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"booking_status"?: string,"category"?: string,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes": number,"external_url"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location_name"?: string | null,"notes"?: string | null,"reservation_ref"?: string | null,"saved_place_id"?: string | null,"starts_at": string,"timezone": string,"title": string,"travel_mode"?: string | null,"trip_id": string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"booking_status"?: string,"category"?: string,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"duration_minutes"?: number,"external_url"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location_name"?: string | null,"notes"?: string | null,"reservation_ref"?: string | null,"saved_place_id"?: string | null,"starts_at"?: string,"timezone"?: string,"title"?: string,"travel_mode"?: string | null,"trip_id"?: string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_saved_place_same_trip"
      columns: ["trip_id","saved_place_id"]
isOneToOne: false
      referencedRelation: "saved_places"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "activities_stop_same_trip"
      columns: ["trip_id","trip_stop_id"]
isOneToOne: false
      referencedRelation: "trip_stops"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "activities_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_participants": {
                  Row: {
                    "activity_id": string,"created_at": string,"traveler_id": string,"trip_id": string
                  }
                  Insert: {
                    "activity_id": string,"created_at"?: string,"traveler_id": string,"trip_id": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"traveler_id"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_participants_trip_id_activity_id_fkey"
      columns: ["trip_id","activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "activity_participants_trip_id_traveler_id_fkey"
      columns: ["trip_id","traveler_id"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    }
                  ]
                },"expense_shares": {
                  Row: {
                    "created_at": string,"expense_id": string,"share": number | null,"traveler_id": string,"trip_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expense_id": string,"share"?: number | null,"traveler_id": string,"trip_id": string
                  }
                  Update: {
                    "created_at"?: string,"expense_id"?: string,"share"?: number | null,"traveler_id"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expense_shares_trip_id_expense_id_fkey"
      columns: ["trip_id","expense_id"]
isOneToOne: false
      referencedRelation: "expenses"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "expense_shares_trip_id_traveler_id_fkey"
      columns: ["trip_id","traveler_id"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"created_by": string | null,"currency": string,"description": string,"id": string,"notes": string | null,"paid_by": string | null,"spent_on": string,"split_mode": string,"trip_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount": number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency": string,"description": string,"id"?: string,"notes"?: string | null,"paid_by"?: string | null,"spent_on": string,"split_mode"?: string,"trip_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string,"id"?: string,"notes"?: string | null,"paid_by"?: string | null,"spent_on"?: string,"split_mode"?: string,"trip_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_paid_by_same_trip"
      columns: ["trip_id","paid_by"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "expenses_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"files": {
                  Row: {
                    "accommodation_id": string | null,"activity_id": string | null,"created_at": string,"document_type": string,"id": string,"mime_type": string,"original_name": string,"size_bytes": number,"storage_path": string,"transportation_id": string | null,"trip_id": string,"updated_at": string,"uploaded_by": string | null
                  }
                  Insert: {
                    "accommodation_id"?: string | null,"activity_id"?: string | null,"created_at"?: string,"document_type"?: string,"id"?: string,"mime_type": string,"original_name": string,"size_bytes": number,"storage_path": string,"transportation_id"?: string | null,"trip_id": string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "accommodation_id"?: string | null,"activity_id"?: string | null,"created_at"?: string,"document_type"?: string,"id"?: string,"mime_type"?: string,"original_name"?: string,"size_bytes"?: number,"storage_path"?: string,"transportation_id"?: string | null,"trip_id"?: string,"updated_at"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "files_accommodation_same_trip"
      columns: ["trip_id","accommodation_id"]
isOneToOne: false
      referencedRelation: "accommodations"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "files_activity_same_trip"
      columns: ["trip_id","activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "files_transportation_same_trip"
      columns: ["trip_id","transportation_id"]
isOneToOne: false
      referencedRelation: "transportations"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "files_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"id": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_places": {
                  Row: {
                    "address": string | null,"category": string,"created_at": string,"created_by": string | null,"estimated_minutes": number | null,"external_url": string | null,"google_place_id": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"trip_id": string,"trip_stop_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"estimated_minutes"?: number | null,"external_url"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"trip_id": string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"category"?: string,"created_at"?: string,"created_by"?: string | null,"estimated_minutes"?: number | null,"external_url"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"trip_id"?: string,"trip_stop_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_places_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_places_stop_same_trip"
      columns: ["trip_id","trip_stop_id"]
isOneToOne: false
      referencedRelation: "trip_stops"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "saved_places_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"settlements": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"currency": string,"from_traveler": string,"id": string,"paid_on": string,"to_traveler": string,"trip_id": string
                  }
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"from_traveler": string,"id"?: string,"paid_on"?: string,"to_traveler": string,"trip_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"from_traveler"?: string,"id"?: string,"paid_on"?: string,"to_traveler"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settlements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "settlements_trip_id_from_traveler_fkey"
      columns: ["trip_id","from_traveler"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "settlements_trip_id_to_traveler_fkey"
      columns: ["trip_id","to_traveler"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    }
                  ]
                },"transportation_participants": {
                  Row: {
                    "created_at": string,"seat": string | null,"transportation_id": string,"traveler_id": string,"trip_id": string
                  }
                  Insert: {
                    "created_at"?: string,"seat"?: string | null,"transportation_id": string,"traveler_id": string,"trip_id": string
                  }
                  Update: {
                    "created_at"?: string,"seat"?: string | null,"transportation_id"?: string,"traveler_id"?: string,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transportation_participants_trip_id_transportation_id_fkey"
      columns: ["trip_id","transportation_id"]
isOneToOne: false
      referencedRelation: "transportations"
      referencedColumns: ["trip_id","id"]
    },{
      foreignKeyName: "transportation_participants_trip_id_traveler_id_fkey"
      columns: ["trip_id","traveler_id"]
isOneToOne: false
      referencedRelation: "travelers"
      referencedColumns: ["trip_id","id"]
    }
                  ]
                },"transportations": {
                  Row: {
                    "arrival_detail": string | null,"arrives_at": string,"arrives_timezone": string,"booking_ref": string | null,"booking_status": string,"booking_url": string | null,"carrier": string | null,"cost_amount": number | null,"cost_currency": string | null,"created_at": string,"created_by": string | null,"departs_at": string,"departs_timezone": string,"departure_detail": string | null,"destination_name": string,"destination_place_id": string | null,"id": string,"notes": string | null,"origin_name": string,"origin_place_id": string | null,"service_number": string | null,"trip_id": string,"type": string,"updated_at": string
                  }
                  Insert: {
                    "arrival_detail"?: string | null,"arrives_at": string,"arrives_timezone": string,"booking_ref"?: string | null,"booking_status"?: string,"booking_url"?: string | null,"carrier"?: string | null,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"departs_at": string,"departs_timezone": string,"departure_detail"?: string | null,"destination_name": string,"destination_place_id"?: string | null,"id"?: string,"notes"?: string | null,"origin_name": string,"origin_place_id"?: string | null,"service_number"?: string | null,"trip_id": string,"type"?: string,"updated_at"?: string
                  }
                  Update: {
                    "arrival_detail"?: string | null,"arrives_at"?: string,"arrives_timezone"?: string,"booking_ref"?: string | null,"booking_status"?: string,"booking_url"?: string | null,"carrier"?: string | null,"cost_amount"?: number | null,"cost_currency"?: string | null,"created_at"?: string,"created_by"?: string | null,"departs_at"?: string,"departs_timezone"?: string,"departure_detail"?: string | null,"destination_name"?: string,"destination_place_id"?: string | null,"id"?: string,"notes"?: string | null,"origin_name"?: string,"origin_place_id"?: string | null,"service_number"?: string | null,"trip_id"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transportations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transportations_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"travelers": {
                  Row: {
                    "color": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"trip_id": string,"updated_at": string,"user_id": string | null
                  }
                  Insert: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"trip_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"trip_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "travelers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "travelers_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "travelers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_exchange_rates": {
                  Row: {
                    "created_at": string,"currency": string,"rate": number,"trip_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"currency": string,"rate": number,"trip_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"rate"?: number,"trip_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_exchange_rates_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_exchange_rates_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_members": {
                  Row: {
                    "created_at": string,"role": string,"trip_id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"role": string,"trip_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"trip_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_members_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_stops": {
                  Row: {
                    "arrives_on": string | null,"created_at": string,"created_by": string | null,"departs_on": string | null,"google_place_id": string | null,"id": string,"lat": number | null,"lng": number | null,"name": string,"notes": string | null,"position": number,"timezone": string,"trip_id": string,"updated_at": string
                  }
                  Insert: {
                    "arrives_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"departs_on"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string | null,"position"?: number,"timezone": string,"trip_id": string,"updated_at"?: string
                  }
                  Update: {
                    "arrives_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"departs_on"?: string | null,"google_place_id"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string | null,"position"?: number,"timezone"?: string,"trip_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_stops_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_stops_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "budget_amount": number | null,"cover_image_path": string | null,"created_at": string,"created_by": string | null,"currency": string,"description": string | null,"end_date": string | null,"id": string,"name": string,"start_date": string | null,"updated_at": string
                  }
                  Insert: {
                    "budget_amount"?: number | null,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"name": string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "budget_amount"?: number | null,"cover_image_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"description"?: string | null,"end_date"?: string | null,"id"?: string,"name"?: string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_edit_trip":
{ Args: { "p_trip_id": string }; Returns: boolean
                           },
"is_trip_member":
{ Args: { "p_trip_id": string }; Returns: boolean
                           },
"is_valid_timezone":
{ Args: { "p_timezone": string }; Returns: boolean
                           },
"link_traveler_to_account":
{ Args: { "p_email": string,"p_role"?: string,"p_traveler_id": string }; Returns: Json
                           },
"move_trip_stop":
{ Args: { "p_direction": number,"p_stop_id": string }; Returns: undefined
                           },
"set_accommodation_participants":
{ Args: { "p_accommodation_id": string,"p_traveler_ids": (string)[] }; Returns: undefined
                           },
"set_activity_participants":
{ Args: { "p_activity_id": string,"p_traveler_ids": (string)[] }; Returns: undefined
                           },
"set_expense_shares":
{ Args: { "p_expense_id": string,"p_mode": string,"p_shares": Json }; Returns: undefined
                           },
"set_transportation_participants":
{ Args: { "p_transportation_id": string,"p_travelers": Json }; Returns: undefined
                           },
"shares_trip_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"transfer_trip_ownership":
{ Args: { "p_new_owner_id": string,"p_trip_id": string }; Returns: undefined
                           },
"trip_id_from_storage_path":
{ Args: { "p_name": string }; Returns: string
                           },
"trip_role":
{ Args: { "p_trip_id": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

