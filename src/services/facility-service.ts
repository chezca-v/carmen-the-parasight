import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore'

interface Facility {
  uid: string
  name: string
  type: string
  email: string
  phone: string
  address: string
  city: string
  province: string
  postalCode: string
  country: string
  website: string
  specialties: string[]
  services: string[]
  operatingHours: {
    monday: { open: string; close: string; closed: boolean }
    tuesday: { open: string; close: string; closed: boolean }
    wednesday: { open: string; close: string; closed: boolean }
    thursday: { open: string; close: string; closed: boolean }
    friday: { open: string; close: string; closed: boolean }
    saturday: { open: string; close: string; closed: boolean }
    sunday: { open: string; close: string; closed: boolean }
  }
  staff: {
    totalStaff: number
    doctors: number
    nurses: number
    supportStaff: number
  }
  capacity: {
    bedCapacity: number
    consultationRooms: number
  }
  languages: string[]
  accreditation: string[]
  insuranceAccepted: string[]
  licenseNumber: string
  description: string
  isActive: boolean
  isSearchable: boolean
  isVerified?: boolean
  profileComplete?: boolean
  createdAt: any
  updatedAt: any
  lastLoginAt?: any
  emailVerified?: boolean
  authProvider?: string
}

interface SearchFilters {
  name?: string
  type?: string
  city?: string
  province?: string
  specialties?: string[]
  services?: string[]
}

class FacilityService {
  private db = getFirestore()

  /**
   * Search for healthcare facilities
   */
  async searchFacilities(filters: SearchFilters = {}): Promise<Facility[]> {
    try {
      console.log('🔍 Searching facilities with filters:', filters)
      
      // Start with a simple query that doesn't require complex indexes
      let q = query(
        collection(this.db, 'facilities'),
        // where('isActive', '==', true), // Temporarily removed to debug
        limit(50)
      )

      const querySnapshot = await getDocs(q)
      const facilities: Facility[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        console.log('🔍 Raw facility data from Firestore:', doc.id, data)
        
        // Handle both old format (direct fields) and new format (under facilityInfo)
        const facilityData = {
          uid: doc.id,
          name: data.facilityInfo?.name || data.name || '',
          type: data.facilityInfo?.type || data.type || '',
          email: data.facilityInfo?.email || data.email || '',
          phone: data.facilityInfo?.phone || data.phone || '',
          address: data.facilityInfo?.address || data.address || '',
          city: data.facilityInfo?.city || data.city || '',
          province: data.facilityInfo?.province || data.province || '',
          postalCode: data.facilityInfo?.postalCode || data.postalCode || '',
          country: data.facilityInfo?.country || data.country || '',
          website: data.facilityInfo?.website || data.website || '',
          description: data.facilityInfo?.description || data.description || '',
          specialties: data.specialties || [],
          services: data.services || [],
          operatingHours: data.operatingHours || {
            monday: { open: '09:00', close: '17:00', closed: false },
            tuesday: { open: '09:00', close: '17:00', closed: false },
            wednesday: { open: '09:00', close: '17:00', closed: false },
            thursday: { open: '09:00', close: '17:00', closed: false },
            friday: { open: '09:00', close: '17:00', closed: false },
            saturday: { open: '09:00', close: '12:00', closed: false },
            sunday: { open: '09:00', close: '17:00', closed: true }
          },
          staff: {
            totalStaff: data.staff?.totalStaff || data.staff?.total || 0,
            doctors: data.staff?.doctors || 0,
            nurses: data.staff?.nurses || 0,
            supportStaff: data.staff?.supportStaff || 0
          },
          capacity: {
            bedCapacity: data.capacity?.bedCapacity || data.capacity?.beds || 0,
            consultationRooms: data.capacity?.consultationRooms || 0
          },
          languages: data.languages || [],
          accreditation: data.accreditation || [],
          insuranceAccepted: data.insuranceAccepted || [],
          licenseNumber: data.licenseNumber || '',
          isActive: data.isActive !== false,
          isSearchable: data.isSearchable !== false,
          isVerified: data.isVerified || false,
          profileComplete: data.profileComplete || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastLoginAt: data.lastLoginAt,
          emailVerified: data.emailVerified || false,
          authProvider: data.authProvider || 'email'
        } as Facility
        
        // Only include facilities that are searchable
        console.log('🔍 Facility searchable check:', facilityData.isSearchable, 'for facility:', facilityData.name)
        console.log('🔍 Facility staff data:', facilityData.staff)
        console.log('🔍 Facility capacity data:', facilityData.capacity)
        
        if (facilityData.isSearchable !== false) {
          facilities.push(facilityData)
        } else {
          console.log('❌ Facility filtered out due to isSearchable:', facilityData.name)
        }
      })

      console.log(`✅ Found ${facilities.length} facilities from database`)

      // Apply filters client-side to avoid index requirements
      let filteredFacilities = facilities

      // Filter by name (case-insensitive)
      if (filters.name) {
        filteredFacilities = filteredFacilities.filter(facility =>
          facility.name.toLowerCase().includes(filters.name!.toLowerCase())
        )
      }

      // Filter by type
      if (filters.type) {
        filteredFacilities = filteredFacilities.filter(facility =>
          facility.type === filters.type
        )
      }

      // Filter by city
      if (filters.city) {
        filteredFacilities = filteredFacilities.filter(facility =>
          facility.city === filters.city
        )
      }

      // Filter by province
      if (filters.province) {
        filteredFacilities = filteredFacilities.filter(facility =>
          facility.province === filters.province
        )
      }

      // Filter by specialties
      if (filters.specialties && filters.specialties.length > 0) {
        filteredFacilities = filteredFacilities.filter(facility =>
          filters.specialties!.some(specialty =>
            facility.specialties.includes(specialty)
          )
        )
      }

      // Filter by services
      if (filters.services && filters.services.length > 0) {
        filteredFacilities = filteredFacilities.filter(facility =>
          filters.services!.some(service =>
            facility.services.includes(service)
          )
        )
      }

      // Sort by name
      filteredFacilities.sort((a, b) => a.name.localeCompare(b.name))

      console.log(`✅ Returning ${filteredFacilities.length} filtered facilities`)
      return filteredFacilities
    } catch (error) {
      console.error('❌ Error searching facilities:', error)
      return []
    }
  }

  /**
   * Get a specific facility by ID
   */
  async getFacility(facilityId: string): Promise<Facility | null> {
    try {
      const facilityRef = doc(this.db, 'facilities', facilityId)
      const facilitySnap = await getDoc(facilityRef)

      if (facilitySnap.exists()) {
        const data = facilitySnap.data() as any
        
        // Handle both old format (direct fields) and new format (under facilityInfo)
        const facilityData = {
          uid: facilitySnap.id,
          name: data.facilityInfo?.name || data.name || '',
          type: data.facilityInfo?.type || data.type || '',
          email: data.facilityInfo?.email || data.email || '',
          phone: data.facilityInfo?.phone || data.phone || '',
          address: data.facilityInfo?.address || data.address || '',
          city: data.facilityInfo?.city || data.city || '',
          province: data.facilityInfo?.province || data.province || '',
          postalCode: data.facilityInfo?.postalCode || data.postalCode || '',
          country: data.facilityInfo?.country || data.country || '',
          website: data.facilityInfo?.website || data.website || '',
          description: data.facilityInfo?.description || data.description || '',
          specialties: data.specialties || [],
          services: data.services || [],
          operatingHours: data.operatingHours || {
            monday: { open: '09:00', close: '17:00', closed: false },
            tuesday: { open: '09:00', close: '17:00', closed: false },
            wednesday: { open: '09:00', close: '17:00', closed: false },
            thursday: { open: '09:00', close: '17:00', closed: false },
            friday: { open: '09:00', close: '17:00', closed: false },
            saturday: { open: '09:00', close: '12:00', closed: false },
            sunday: { open: '09:00', close: '17:00', closed: true }
          },
          staff: {
            totalStaff: data.staff?.totalStaff || data.staff?.total || 0,
            doctors: data.staff?.doctors || 0,
            nurses: data.staff?.nurses || 0,
            supportStaff: data.staff?.supportStaff || 0
          },
          capacity: {
            bedCapacity: data.capacity?.bedCapacity || data.capacity?.beds || 0,
            consultationRooms: data.capacity?.consultationRooms || 0
          },
          languages: data.languages || [],
          accreditation: data.accreditation || [],
          insuranceAccepted: data.insuranceAccepted || [],
          licenseNumber: data.licenseNumber || '',
          isActive: data.isActive !== false,
          isSearchable: data.isSearchable !== false,
          isVerified: data.isVerified || false,
          profileComplete: data.profileComplete || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastLoginAt: data.lastLoginAt,
          emailVerified: data.emailVerified || false,
          authProvider: data.authProvider || 'email'
        } as Facility
        
        return facilityData
      }

      return null
    } catch (error) {
      console.error('Error getting facility:', error)
      throw error
    }
  }

  /**
   * Get all facility types
   */
  async getFacilityTypes(): Promise<string[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true)
      )

      const querySnapshot = await getDocs(q)
      const types = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        const type = data.facilityInfo?.type || data.type
        if (type) {
          types.add(type)
        }
      })

      return Array.from(types).sort()
    } catch (error) {
      console.error('Error getting facility types:', error)
      throw error
    }
  }

  /**
   * Get all cities with facilities
   */
  async getCities(): Promise<string[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true)
      )

      const querySnapshot = await getDocs(q)
      const cities = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        const city = data.facilityInfo?.city || data.city
        if (city) {
          cities.add(city)
        }
      })

      return Array.from(cities).sort()
    } catch (error) {
      console.error('Error getting cities:', error)
      throw error
    }
  }

  /**
   * Get all provinces with facilities
   */
  async getProvinces(): Promise<string[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true)
      )

      const querySnapshot = await getDocs(q)
      const provinces = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        const province = data.facilityInfo?.province || data.province
        if (province) {
          provinces.add(province)
        }
      })

      return Array.from(provinces).sort()
    } catch (error) {
      console.error('Error getting provinces:', error)
      throw error
    }
  }

  /**
   * Get all specialties available across facilities
   */
  async getSpecialties(): Promise<string[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true)
      )

      const querySnapshot = await getDocs(q)
      const specialties = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        const facilitySpecialties = data.specialties || []
        if (facilitySpecialties.length > 0) {
          facilitySpecialties.forEach((specialty: string) => specialties.add(specialty))
        }
      })

      return Array.from(specialties).sort()
    } catch (error) {
      console.error('Error getting specialties:', error)
      throw error
    }
  }

  /**
   * Get all services available across facilities
   */
  async getServices(): Promise<string[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true)
      )

      const querySnapshot = await getDocs(q)
      const services = new Set<string>()

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        const facilityServices = data.services || []
        if (facilityServices.length > 0) {
          facilityServices.forEach((service: string) => services.add(service))
        }
      })

      return Array.from(services).sort()
    } catch (error) {
      console.error('Error getting services:', error)
      throw error
    }
  }

  /**
   * Get nearby facilities (simplified - just by city for now)
   */
  async getNearbyFacilities(city: string, limit: number = 10): Promise<Facility[]> {
    try {
      const q = query(
        collection(this.db, 'facilities'),
        where('isActive', '==', true),
        where('isSearchable', '==', true),
        where('city', '==', city),
        orderBy('name'),
        limit(limit)
      )

      const querySnapshot = await getDocs(q)
      const facilities: Facility[] = []

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any
        
        // Handle both old format (direct fields) and new format (under facilityInfo)
        const facilityData = {
          uid: doc.id,
          name: data.facilityInfo?.name || data.name || '',
          type: data.facilityInfo?.type || data.type || '',
          email: data.facilityInfo?.email || data.email || '',
          phone: data.facilityInfo?.phone || data.phone || '',
          address: data.facilityInfo?.address || data.address || '',
          city: data.facilityInfo?.city || data.city || '',
          province: data.facilityInfo?.province || data.province || '',
          postalCode: data.facilityInfo?.postalCode || data.postalCode || '',
          country: data.facilityInfo?.country || data.country || '',
          website: data.facilityInfo?.website || data.website || '',
          description: data.facilityInfo?.description || data.description || '',
          specialties: data.specialties || [],
          services: data.services || [],
          operatingHours: data.operatingHours || {
            monday: { open: '09:00', close: '17:00', closed: false },
            tuesday: { open: '09:00', close: '17:00', closed: false },
            wednesday: { open: '09:00', close: '17:00', closed: false },
            thursday: { open: '09:00', close: '17:00', closed: false },
            friday: { open: '09:00', close: '17:00', closed: false },
            saturday: { open: '09:00', close: '12:00', closed: false },
            sunday: { open: '09:00', close: '17:00', closed: true }
          },
          staff: {
            totalStaff: data.staff?.totalStaff || data.staff?.total || 0,
            doctors: data.staff?.doctors || 0,
            nurses: data.staff?.nurses || 0,
            supportStaff: data.staff?.supportStaff || 0
          },
          capacity: {
            bedCapacity: data.capacity?.bedCapacity || data.capacity?.beds || 0,
            consultationRooms: data.capacity?.consultationRooms || 0
          },
          languages: data.languages || [],
          accreditation: data.accreditation || [],
          insuranceAccepted: data.insuranceAccepted || [],
          licenseNumber: data.licenseNumber || '',
          isActive: data.isActive !== false,
          isSearchable: data.isSearchable !== false,
          isVerified: data.isVerified || false,
          profileComplete: data.profileComplete || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          lastLoginAt: data.lastLoginAt,
          emailVerified: data.emailVerified || false,
          authProvider: data.authProvider || 'email'
        } as Facility
        
        facilities.push(facilityData)
      })

      return facilities
    } catch (error) {
      console.error('Error getting nearby facilities:', error)
      throw error
    }
  }
}

export default new FacilityService()
export type { Facility, SearchFilters } 