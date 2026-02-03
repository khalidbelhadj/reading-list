package main

import (
	"database/sql"
	"log"
	"slices"
	"strings"

	"github.com/google/uuid"
)

type Item struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	Starred   bool   `json:"starred"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	Tags      []Tag  `json:"tags"`
}

type Tag struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type DBConn interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
}

func getItems(conn DBConn) ([]Item, error) {
	query := `
		SELECT
			i.id, i.title, i.url, i.starred, i.created_at, i.updated_at, t.id as tag_id, t.name as tag_name
		FROM
			items i
		LEFT JOIN
			items_tags it ON i.id = it.item_id
		LEFT JOIN
			tags t ON it.tag_id = t.id
		ORDER BY
			i.id
	`
	rows, err := conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	itemsMap := make(map[string]*Item)

	for rows.Next() {
		var itemID, title, url string
		var starred bool
		var createdAt, updatedAt string
		var tagID sql.NullInt64
		var tagName sql.NullString

		err := rows.Scan(&itemID, &title, &url, &starred, &createdAt, &updatedAt, &tagID, &tagName)
		if err != nil {
			return nil, err
		}

		if _, exists := itemsMap[itemID]; !exists {
			itemsMap[itemID] = &Item{
				ID:        itemID,
				Title:     title,
				URL:       url,
				Starred:   starred,
				CreatedAt: createdAt,
				UpdatedAt: updatedAt,
				Tags:      []Tag{},
			}
		}

		if tagID.Valid && tagName.Valid {
			itemsMap[itemID].Tags = append(itemsMap[itemID].Tags, Tag{
				ID:   int(tagID.Int64),
				Name: tagName.String,
			})
		}
	}

	var items []Item
	for _, item := range itemsMap {
		items = append(items, *item)
	}

	return items, nil
}

func getItemByID(conn DBConn, itemID string) (*Item, error) {
	query := `
		SELECT
			i.id, i.title, i.url, i.starred, i.created_at, i.updated_at, t.id as tag_id, t.name as tag_name
		FROM
			items i
		LEFT JOIN
			items_tags it ON i.id = it.item_id
		LEFT JOIN
			tags t ON it.tag_id = t.id
		WHERE
			i.id = ?
	`
	rows, err := conn.Query(query, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var item *Item

	for rows.Next() {
		var itemID, title, url string
		var starred bool
		var createdAt, updatedAt string
		var tagID sql.NullInt64
		var tagName sql.NullString

		err := rows.Scan(&itemID, &title, &url, &starred, &createdAt, &updatedAt, &tagID, &tagName)
		if err != nil {
			return nil, err
		}

		if item == nil {
			item = &Item{
				ID:        itemID,
				Title:     title,
				URL:       url,
				Starred:   starred,
				CreatedAt: createdAt,
				UpdatedAt: updatedAt,
				Tags:      []Tag{},
			}
		}

		if tagID.Valid && tagName.Valid {
			item.Tags = append(item.Tags, Tag{
				ID:   int(tagID.Int64),
				Name: tagName.String,
			})
		}
	}

	return item, nil
}

func createItem(db *sql.DB, title string, url string, tagNames []string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	itemID := uuid.NewString()

	_, err = tx.Exec(
		"INSERT INTO items (id, title, url, starred, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		itemID,
		title,
		url,
		false,
	)
	if err != nil {
		return err
	}

	insertItemTagStmt, err := tx.Prepare("INSERT INTO items_tags (item_id, tag_id) VALUES (?, ?)")
	if err != nil {
		return err
	}

	for _, tagName := range tagNames {
		tagID, err := createOrGetTagByName(tx, tagName)
		if err != nil {
			return err
		}
		_, err = insertItemTagStmt.Exec(itemID, tagID)
		if err != nil {
			return err
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func updateItem(db *sql.DB, itemID string, title *string, url *string, starred *bool, tagNames []string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	set := []string{}
	args := []any{}

	if title != nil {
		set = append(set, "title = ?")
		args = append(args, *title)
	}
	if url != nil {
		set = append(set, "url = ?")
		args = append(args, *url)
	}
	if starred != nil {
		set = append(set, "starred = ?")
		args = append(args, *starred)
	}

	if len(set) == 0 {
		return nil
	}

	set = append(set, "updated_at = CURRENT_TIMESTAMP")
	query := "UPDATE items SET " + strings.Join(set, ", ") + " WHERE id = ?"
	args = append(args, itemID)

	_, err = tx.Exec(query, args...)
	if err != nil {
		return err
	}

	existingTagIDs := []int{}
	rows, err := tx.Query("SELECT tag_id FROM items_tags WHERE item_id = ?", itemID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var tagID int
		err := rows.Scan(&tagID)
		if err != nil {
			return err
		}
		existingTagIDs = append(existingTagIDs, tagID)
	}

	newTagIDs := []int{}
	for _, tagName := range tagNames {
		newTagID, err := createOrGetTagByName(tx, tagName)
		if err != nil {
			return err
		}

		newTagIDs = append(newTagIDs, newTagID)
	}

	for _, tagID := range existingTagIDs {
		found := slices.Contains(newTagIDs, tagID)
		if !found {
			_, err = tx.Exec("DELETE FROM items_tags WHERE item_id = ? AND tag_id = ?", itemID, tagID)
			if err != nil {
				return err
			}
		}
	}

	for _, tagID := range newTagIDs {
		found := slices.Contains(existingTagIDs, tagID)
		if !found {
			_, err = tx.Exec("INSERT INTO items_tags (item_id, tag_id) VALUES (?, ?)", itemID, tagID)
			if err != nil {
				return err
			}
		}
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func tagItem(db *sql.DB, itemID string, tagName string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err = tagItemTxn(tx, itemID, tagName); err != nil {
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func tagItemTxn(tx *sql.Tx, itemID string, tagName string) error {
	tagID, err := createOrGetTagByName(tx, tagName)
	if err != nil {
		return err
	}

	_, err = tx.Exec("INSERT INTO items_tags (item_id, tag_id) VALUES (?, ?)", itemID, tagID)
	if err != nil {
		return err
	}

	return nil
}

func untagItem(db *sql.DB, itemID string, tagID int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err = untagItemTxn(tx, itemID, tagID); err != nil {
		return err
	}

	err = tx.Commit()
	if err != nil {
		return err
	}

	return nil
}

func untagItemTxn(tx *sql.Tx, itemID string, tagID int) error {
	_, err := tx.Exec("DELETE FROM items_tags WHERE item_id = ? AND tag_id = ?", itemID, tagID)
	if err != nil {
		return err
	}

	var count int
	err = tx.QueryRow("SELECT COUNT(*) FROM items_tags WHERE tag_id = ?", tagID).Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		_, err = tx.Exec("DELETE FROM tags WHERE id = ?", tagID)
		if err != nil {
			return err
		}
	}

	return nil
}

func createOrGetTagByName(conn DBConn, tagName string) (int, error) {
	var tagID int
	err := conn.QueryRow("SELECT id FROM tags WHERE name = ?", tagName).Scan(&tagID)

	if err == sql.ErrNoRows {
		res, err := conn.Exec("INSERT INTO tags (name) VALUES (?)", tagName)
		if err != nil {
			return -1, err
		}
		lastID, err := res.LastInsertId()
		if err != nil {
			return -1, err
		}
		tagID = int(lastID)
	} else if err != nil {
		return -1, err
	}

	return tagID, nil
}

func getTags(db *sql.DB) ([]Tag, error) {
	rows, err := db.Query("SELECT id, name FROM tags")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var tag Tag
		err := rows.Scan(&tag.ID, &tag.Name)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

func seedDB(db *sql.DB) error {
	seedItems := []struct {
		Title string
		URL   string
		Tags  []string
	}{
		{
			Title: "Go Blog: Error handling and Go",
			URL:   "https://go.dev/blog/error-handling-and-go",
			Tags:  []string{"go", "errors"},
		},
		{
			Title: "SQLite Documentation",
			URL:   "https://www.sqlite.org/docs.html",
			Tags:  []string{"database", "sqlite"},
		},
		{
			Title: "React Query Overview",
			URL:   "https://tanstack.com/query/latest/docs/framework/react/overview",
			Tags:  []string{"react", "data"},
		},
		{
			Title: "Vite Guide",
			URL:   "https://vite.dev/guide/",
			Tags:  []string{"frontend", "tooling"},
		},
		{
			Title: "REST API Design",
			URL:   "https://restfulapi.net/",
			Tags:  []string{"api", "design"},
		},
		{
			Title: "Go Concurrency Patterns",
			URL:   "https://go.dev/blog/pipelines",
			Tags:  []string{"go", "concurrency"},
		},
		{
			Title: "HTTP RFC 9110",
			URL:   "https://www.rfc-editor.org/rfc/rfc9110",
			Tags:  []string{"http", "standards"},
		},
		{
			Title: "MDN: HTTP CORS",
			URL:   "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS",
			Tags:  []string{"http", "cors"},
		},
		{
			Title: "SQLite Query Planner",
			URL:   "https://www.sqlite.org/queryplanner.html",
			Tags:  []string{"database", "performance"},
		},
		{
			Title: "React Hooks Reference",
			URL:   "https://react.dev/reference/react",
			Tags:  []string{"react", "hooks"},
		},
		{
			Title: "Vite Environment Variables",
			URL:   "https://vite.dev/guide/env-and-mode.html",
			Tags:  []string{"frontend", "config"},
		},
		{
			Title: "SQL Style Guide",
			URL:   "https://www.sqlstyle.guide/",
			Tags:  []string{"sql", "style"},
		},
	}

	for _, item := range seedItems {
		if err := createItem(db, item.Title, item.URL, item.Tags); err != nil {
			return err
		}
	}

	return nil
}

func initDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "./database.db")
	if err != nil {
		log.Fatal(err)
	}

	createItemTable := `
	CREATE TABLE IF NOT EXISTS items (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		url TEXT NOT NULL,
		starred BOOLEAN DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	)
	`
	_, err = db.Exec(createItemTable)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec("ALTER TABLE items ADD COLUMN created_at TEXT")
	if err != nil && err.Error() != "duplicate column name: created_at" {
		log.Fatal(err)
	}

	_, err = db.Exec("ALTER TABLE items ADD COLUMN updated_at TEXT")
	if err != nil && err.Error() != "duplicate column name: updated_at" {
		log.Fatal(err)
	}

	_, err = db.Exec("UPDATE items SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL")
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec("UPDATE items SET updated_at = created_at WHERE updated_at IS NULL")
	if err != nil {
		log.Fatal(err)
	}

	createTagsTable := `
	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL
		)
		`

	_, err = db.Exec(createTagsTable)
	if err != nil {
		log.Fatal(err)
	}

	createItemsTagsTable := `
	CREATE TABLE IF NOT EXISTS items_tags (
		item_id TEXT,
		tag_id INTEGER,
		PRIMARY KEY (item_id, tag_id),
		FOREIGN KEY (item_id) REFERENCES items(id),
		FOREIGN KEY (tag_id) REFERENCES tags(id)
	)
	`

	_, err = db.Exec(createItemsTagsTable)
	if err != nil {
		log.Fatal(err)
	}

	return db, nil
}
