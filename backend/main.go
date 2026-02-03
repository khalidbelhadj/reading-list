package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

func logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))

		bodyBytes, err := io.ReadAll(r.Body)
		if err == nil && len(bodyBytes) > 0 {
			log.Printf("Body: %s", bodyBytes)
			r.Body.Close()
			r.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		}

		next.ServeHTTP(w, r)
	})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		switch origin {
		case "http://localhost:5173", "http://127.0.0.1:5173":
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		default:
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	uuid.SetClockSequence(uuid.ClockSequence())

	db, err := initDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if len(os.Args) > 1 && os.Args[1] == "seed" {
		if err := db.Close(); err != nil {
			log.Fatal(err)
		}
		if err := os.Remove("database.db"); err != nil && !os.IsNotExist(err) {
			log.Fatal(err)
		}
		db, err := initDB()
		if err != nil {
			log.Fatal(err)
		}
		defer db.Close()

		if err := seedDB(db); err != nil {
			log.Fatal(err)
		}
		log.Println("Seed complete")
		return
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /items", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		items, err := getItems(db)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		err = json.NewEncoder(w).Encode(items)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")

		id := r.PathValue("id")

		item, err := getItemByID(db, id)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if item == nil {
			http.Error(w, "Item not found", http.StatusNotFound)
			return
		}

		err = json.NewEncoder(w).Encode(item)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	mux.HandleFunc("POST /items", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		defer r.Body.Close()

		var newItem struct {
			Title *string  `json:"title"`
			URL   *string  `json:"url"`
			Tags  []string `json:"tags"`
		}

		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()

		if err := decoder.Decode(&newItem); err != nil {
			http.Error(w, "Invalid JSON body: "+err.Error(), http.StatusBadRequest)
			return
		}

		if decoder.Decode(&struct{}{}) != io.EOF {
			http.Error(w, "Request body must contain a single JSON object", http.StatusBadRequest)
			return
		}

		if newItem.Title == nil || *newItem.Title == "" {
			http.Error(w, "title is required", http.StatusBadRequest)
			return
		}

		if newItem.URL == nil || *newItem.URL == "" {
			http.Error(w, "url is required", http.StatusBadRequest)
			return
		}

		if err := createItem(db, *newItem.Title, *newItem.URL, newItem.Tags); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	mux.HandleFunc("PATCH /items/{itemID}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		itemID := r.PathValue("itemID")

		defer r.Body.Close()

		var newFields struct {
			Title    *string   `json:"title"`
			URL      *string   `json:"url"`
			Starred  *bool     `json:"starred"`
			TagNames *[]string `json:"tagNames"`
		}

		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()

		if err := decoder.Decode(&newFields); err != nil {
			http.Error(w, "Invalid JSON body: "+err.Error(), http.StatusBadRequest)
			return
		}

		if decoder.Decode(&struct{}{}) != io.EOF {
			http.Error(w, "Request body must contain a single JSON object", http.StatusBadRequest)
			return
		}

		tagNames := []string{}
		if newFields.TagNames != nil {
			tagNames = *newFields.TagNames
		}

		log.Printf("updating item %s: %+v", itemID, newFields)
		err := updateItem(db, itemID, newFields.Title, newFields.URL, newFields.Starred, tagNames)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	mux.HandleFunc("POST /items/{itemID}/tag", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		itemID := r.PathValue("itemID")

		defer r.Body.Close()
		var tagName string
		decoder := json.NewDecoder(r.Body)

		if err := decoder.Decode(&tagName); err != nil {
			http.Error(w, "Invalid JSON body: "+err.Error(), http.StatusBadRequest)
			return
		}

		if tagName == "" {
			http.Error(w, "tag name is required", http.StatusBadRequest)
			return
		}

		err = tagItem(db, itemID, tagName)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	mux.HandleFunc("POST /items/{itemID}/untag", func(w http.ResponseWriter, r *http.Request) {

	})

	mux.HandleFunc("GET /tags", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Content-Type", "application/json")
		tags, err := getTags(db)

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		err = json.NewEncoder(w).Encode(tags)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	})

	handler := logger(cors(mux))

	server := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	log.Println("Server is running on http://localhost:8080")
	go func() {
		if err := server.ListenAndServe(); err != nil {
			log.Fatal(err)
		}
	}()

	select {}
}
