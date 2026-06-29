<?php
/**
 * POST /api/logout.php
 */
require_once __DIR__ . '/auth.php';

logoutUser();
jsonResponse(['success' => true]);
